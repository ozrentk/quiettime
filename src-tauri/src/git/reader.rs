use super::{
    models::{Commit, Inspection, Repository},
    process,
};
use std::path::{Path, PathBuf};

fn clean_path(path: &Path) -> String {
    let value = path.to_string_lossy();
    if let Some(unc) = value.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{unc}")
    } else {
        value.strip_prefix(r"\\?\").unwrap_or(&value).to_string()
    }
}

pub(crate) fn inspect(path: &str) -> Result<Inspection, String> {
    let path = std::fs::canonicalize(path.trim())
        .map_err(|e| format!("Cannot open repository folder: {e}"))?;
    if !path.is_dir() {
        return Err("Choose a repository folder".into());
    }
    let path = PathBuf::from(clean_path(&path));
    let root = process::checked(&path, &["rev-parse", "--show-toplevel"])?;
    let root = String::from_utf8(root).map_err(|_| "Repository path is not valid UTF-8")?;
    let root = std::fs::canonicalize(root.trim()).map_err(|e| e.to_string())?;
    let configured = process::run(
        Path::new(&clean_path(&root)),
        &["config", "--get-all", "user.email"],
    )?;
    if !configured.status.success() && configured.status.code() != Some(1) {
        return Err(configured.stderr);
    }
    let mut authors = Vec::new();
    for email in String::from_utf8_lossy(&configured.stdout)
        .lines()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        if !authors
            .iter()
            .any(|existing: &String| existing.eq_ignore_ascii_case(email))
        {
            authors.push(email.to_string());
        }
    }
    Ok(Inspection {
        name: root
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        path: clean_path(&root),
        authors,
    })
}

pub(crate) fn read(repository: &Repository) -> Result<Vec<Commit>, String> {
    let path = Path::new(&repository.path);
    let root = process::checked(path, &["rev-parse", "--show-toplevel"])?;
    let root = String::from_utf8(root).map_err(|_| "Repository path is not valid UTF-8")?;
    let actual = std::fs::canonicalize(root.trim()).map_err(|e| e.to_string())?;
    let registered = std::fs::canonicalize(path).map_err(|e| e.to_string())?;
    if clean_path(&actual).to_lowercase() != clean_path(&registered).to_lowercase() {
        return Err(
            "This folder is no longer the registered Git repository root. Check its path.".into(),
        );
    }
    let since = format!("--since-as-filter=@{}", repository.since / 1000);
    let bytes = process::checked(
        path,
        &[
            "log",
            "--all",
            &since,
            "--no-show-signature",
            "--no-decorate",
            "--no-color",
            "--encoding=UTF-8",
            "-z",
            "--format=%H%x00%an%x00%ae%x00%at%x00%ct%x00%s",
        ],
    )?;
    parse(&bytes, repository)
}

fn parse(bytes: &[u8], repository: &Repository) -> Result<Vec<Commit>, String> {
    if bytes.is_empty() {
        return Ok(Vec::new());
    }
    let mut fields: Vec<_> = bytes.split(|byte| *byte == 0).collect();
    if fields.last().is_some_and(|field| field.is_empty()) {
        fields.pop();
    }
    if fields.len() % 6 != 0 {
        return Err("Git returned an unexpected commit format".into());
    }
    let mut commits = Vec::new();
    for row in fields.chunks_exact(6) {
        let text = |index| String::from_utf8_lossy(row[index]).to_string();
        let email = text(2);
        if !repository.all_authors
            && !repository
                .authors
                .iter()
                .any(|author| author.eq_ignore_ascii_case(&email))
        {
            continue;
        }
        let timestamp = |index| -> Result<i64, String> {
            text(index)
                .parse::<i64>()
                .ok()
                .and_then(|seconds| seconds.checked_mul(1000))
                .ok_or("Git returned an invalid commit timestamp".into())
        };
        let committed_at = timestamp(4)?;
        if committed_at < repository.since {
            continue;
        }
        commits.push(Commit {
            sha: text(0),
            author_name: text(1),
            author_email: email,
            authored_at: timestamp(3)?,
            committed_at,
            subject: text(5),
        });
    }
    Ok(commits)
}
