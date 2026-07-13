//! SDD pipeline state — derived from the filesystem and git, never stored.
//!
//! The Pipeline panel shows the four harness phases (spike → plan → task →
//! pr).  Phase completion is a *fact about the worktree*, not tracked
//! state: a phase is done when its artifact exists.  That makes the panel
//! survive restarts, worktree switches, and out-of-band work (running the
//! commands in a plain terminal still lights the panel up).
//!
//! Every field is optional — a missing repo, a detached HEAD, or `gh` not
//! being installed degrade to `None`, never to an error the UI has to
//! special-case.

use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Default)]
pub struct PipelineState {
    pub branch: Option<String>,
    /// Commits on HEAD that are not on the default branch (merge-base count).
    pub commits_ahead: Option<u32>,
    pub spike_doc: Option<String>,
    pub spec_doc: Option<String>,
    pub plan_doc: Option<String>,
    pub pr_number: Option<u64>,
    pub pr_url: Option<String>,
    pub pr_state: Option<String>,
    /// Exact PR timestamps from gh (ISO 8601) — used by the delivery
    /// (lead-time) metrics so pr_opened/pr_merged aren't recorded at
    /// observation time.
    pub pr_created_at: Option<String>,
    pub pr_merged_at: Option<String>,
}

/// Find the first existing file among `candidates` (relative to `root`).
fn find_doc(root: &Path, candidates: &[&str]) -> Option<String> {
    for c in candidates {
        let p = root.join(c);
        if p.is_file() {
            return Some(p.to_string_lossy().into_owned());
        }
    }
    None
}

/// Spike docs don't have one canonical name — scan root and docs/ for
/// `SPIKE*.md` / `spike*.md`, newest mtime wins.
fn find_spike_doc(root: &Path) -> Option<String> {
    let mut best: Option<(std::time::SystemTime, String)> = None;
    for dir in [root.to_path_buf(), root.join("docs")] {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let lower = name.to_lowercase();
            if lower.starts_with("spike") && lower.ends_with(".md") {
                let Ok(meta) = entry.metadata() else { continue };
                if !meta.is_file() {
                    continue;
                }
                let mtime = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
                let path = entry.path().to_string_lossy().into_owned();
                if best.as_ref().map(|(t, _)| mtime > *t).unwrap_or(true) {
                    best = Some((mtime, path));
                }
            }
        }
    }
    best.map(|(_, p)| p)
}

/// Branch name + commits ahead of the default branch, via git2.
fn git_facts(root: &Path) -> (Option<String>, Option<u32>) {
    let Ok(repo) = git2::Repository::discover(root) else {
        return (None, None);
    };
    let Ok(head) = repo.head() else {
        return (None, None);
    };
    let branch = head.shorthand().map(String::from);
    let Some(head_oid) = head.target() else {
        return (branch, None);
    };

    // Default branch: origin/HEAD if resolvable, else main/master.
    let default_oid = [
        "refs/remotes/origin/HEAD",
        "refs/heads/main",
        "refs/heads/master",
    ]
    .iter()
    .find_map(|name| {
        repo.find_reference(name)
            .ok()
            .and_then(|r| r.resolve().ok())
            .and_then(|r| r.target())
    });
    let Some(default_oid) = default_oid else {
        return (branch, None);
    };
    if default_oid == head_oid {
        return (branch, Some(0));
    }
    let ahead = repo
        .graph_ahead_behind(head_oid, default_oid)
        .ok()
        .map(|(a, _)| a as u32);
    (branch, ahead)
}

/// Open PR for the current branch via `gh pr view`.  `gh` missing, not
/// authenticated, or no PR → all-None.
type PrFacts = (
    Option<u64>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
);

fn pr_facts(root: &Path) -> PrFacts {
    let out = std::process::Command::new("gh")
        .args(["pr", "view", "--json", "number,url,state,createdAt,mergedAt"])
        .current_dir(root)
        .output();
    let Ok(out) = out else {
        return (None, None, None, None, None);
    };
    if !out.status.success() {
        return (None, None, None, None, None);
    }
    let Ok(v) = serde_json::from_slice::<serde_json::Value>(&out.stdout) else {
        return (None, None, None, None, None);
    };
    let s = |key: &str| v.get(key).and_then(|x| x.as_str()).map(String::from);
    (
        v.get("number").and_then(|n| n.as_u64()),
        s("url"),
        s("state"),
        s("createdAt"),
        s("mergedAt"),
    )
}

pub fn compute_pipeline_state(working_dir: &str) -> PipelineState {
    let root = Path::new(working_dir);
    if !root.is_dir() {
        return PipelineState::default();
    }

    let (branch, commits_ahead) = git_facts(root);
    let (pr_number, pr_url, pr_state, pr_created_at, pr_merged_at) = pr_facts(root);

    PipelineState {
        branch,
        commits_ahead,
        spike_doc: find_spike_doc(root),
        spec_doc: find_doc(root, &["SPEC.md", "docs/SPEC.md"]),
        plan_doc: find_doc(root, &["PLAN.md", "docs/PLAN.md"]),
        pr_number,
        pr_url,
        pr_state,
        pr_created_at,
        pr_merged_at,
    }
}

/// Async command: `gh pr view` does network IO, so run the whole derivation
/// off the main thread.
#[tauri::command]
pub async fn get_pipeline_state(working_dir: String) -> Result<PipelineState, String> {
    tokio::task::spawn_blocking(move || compute_pipeline_state(&working_dir))
        .await
        .map_err(|e| e.to_string())
}

/// On-demand merge check for a SPECIFIC PR number (delivery metrics —
/// fired when the Consumo Geral view opens, for PRs whose merge wasn't
/// observed while a session was alive).  Returns gh's exact `mergedAt`
/// when the PR is merged, None otherwise.  Missing repo dir, gh absent,
/// or network failure all degrade to Ok(None) — the check retries on
/// the next open.
#[tauri::command]
pub async fn check_pr_merged(
    repo_path: String,
    pr_number: u64,
) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        let root = Path::new(&repo_path);
        if !root.is_dir() {
            return None;
        }
        let out = std::process::Command::new("gh")
            .args([
                "pr",
                "view",
                &pr_number.to_string(),
                "--json",
                "state,mergedAt",
            ])
            .current_dir(root)
            .output()
            .ok()?;
        if !out.status.success() {
            return None;
        }
        let v = serde_json::from_slice::<serde_json::Value>(&out.stdout).ok()?;
        if v.get("state").and_then(|s| s.as_str()) != Some("MERGED") {
            return None;
        }
        v.get("mergedAt")
            .and_then(|m| m.as_str())
            .map(String::from)
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_dir_yields_default() {
        let s = compute_pipeline_state("/nonexistent/path/xyz");
        assert!(s.branch.is_none());
        assert!(s.spec_doc.is_none());
    }

    #[test]
    fn finds_docs_in_root_and_docs_dir() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir(tmp.path().join("docs")).unwrap();
        std::fs::write(tmp.path().join("SPEC.md"), "# spec").unwrap();
        std::fs::write(tmp.path().join("docs/PLAN.md"), "# plan").unwrap();
        std::fs::write(tmp.path().join("docs/spike-auth.md"), "# spike").unwrap();

        let s = compute_pipeline_state(tmp.path().to_str().unwrap());
        assert!(s.spec_doc.as_deref().unwrap().ends_with("SPEC.md"));
        assert!(s.plan_doc.as_deref().unwrap().ends_with("PLAN.md"));
        assert!(s.spike_doc.as_deref().unwrap().ends_with("spike-auth.md"));
    }
}
