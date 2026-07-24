import { access, readFile, readdir } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillDirectories = [
  resolve(projectRoot, "skills/agent-forum"),
  resolve(projectRoot, "skills/agent-forum-viewer"),
  resolve(projectRoot, "skills/agent-forum-dashboard"),
];
const errors = [];
const warnings = [];

function characterCount(value) {
  return Array.from(value).length;
}

function parseFrontmatter(source) {
  const normalized = source.replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");
  if (lines[0] !== "---") {
    throw new Error("SKILL.md must start with YAML front matter");
  }

  const end = lines.indexOf("---", 1);
  if (end === -1) {
    throw new Error("SKILL.md front matter is not closed");
  }

  const fields = {};
  for (const line of lines.slice(1, end)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new Error(`Unsupported front matter line: ${line}`);
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }

  return { fields, body: lines.slice(end + 1).join("\n") };
}

async function findSkillFiles(directory) {
  const found = [];
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return found;
    throw error;
  }

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await findSkillFiles(path)));
    if (entry.isFile() && entry.name === "SKILL.md") found.push(path);
  }
  return found;
}

try {
  for (const skillDirectory of skillDirectories) {
  const skillFile = resolve(skillDirectory, "SKILL.md");
  const source = await readFile(skillFile, "utf8");
  const { fields, body } = parseFrontmatter(source);
  const name = fields.name ?? "";
  const description = fields.description ?? "";
  const compatibility = fields.compatibility ?? "";

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    errors.push("name must contain lowercase letters, numbers, and single hyphens only");
  }
  if (characterCount(name) > 64) errors.push("name exceeds 64 characters");
  if (name !== basename(skillDirectory)) {
    errors.push(`name '${name}' must match directory '${basename(skillDirectory)}'`);
  }
  if (characterCount(description) === 0) errors.push("description is required");
  if (characterCount(description) > 1024) {
    errors.push(`description exceeds 1024 characters (${characterCount(description)})`);
  } else if (characterCount(description) > 700) {
    errors.push(`description exceeds the project limit of 700 characters (${characterCount(description)})`);
  }
  if (characterCount(compatibility) > 500) {
    errors.push(`compatibility exceeds 500 characters (${characterCount(compatibility)})`);
  }

  const bodyLines = body.split("\n").length;
  const estimatedTokens = Math.ceil(characterCount(body) / 4);
  if (bodyLines > 500) errors.push(`SKILL.md body exceeds 500 lines (${bodyLines})`);
  if (bodyLines > 300) warnings.push(`SKILL.md body exceeds the 300-line target (${bodyLines})`);
  if (estimatedTokens > 5000) {
    errors.push(`SKILL.md body exceeds the estimated 5000-token limit (${estimatedTokens})`);
  }

  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of body.matchAll(linkPattern)) {
    const target = match[1]?.trim().split(/\s+/u)[0];
    if (!target || /^(?:https?:|mailto:|#)/u.test(target)) continue;
    const withoutAnchor = target.split("#", 1)[0];
    if (!withoutAnchor) continue;
    const referencedPath = resolve(skillDirectory, decodeURIComponent(withoutAnchor));
    if (!referencedPath.startsWith(`${skillDirectory}${sep}`)) {
      errors.push(`reference escapes the skill directory: ${target}`);
      continue;
    }
    try {
      await access(referencedPath);
    } catch {
      errors.push(`missing reference: ${target}`);
    }
  }

  const skillFiles = [
    ...(await findSkillFiles(resolve(projectRoot, "skills"))),
    ...(await findSkillFiles(resolve(projectRoot, "adapters"))),
  ];
  const names = new Map();
  for (const path of skillFiles) {
    const parsed = parseFrontmatter(await readFile(path, "utf8"));
    const currentName = parsed.fields.name;
    if (!currentName) continue;
    const previous = names.get(currentName);
    if (previous) errors.push(`duplicate skill name '${currentName}': ${previous}, ${path}`);
    else names.set(currentName, path);
  }

  for (const warning of warnings) console.warn(`Warning: ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`Error: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Validated ${skillFile}: description=${characterCount(description)} chars, body=${bodyLines} lines, estimatedTokens=${estimatedTokens}`,
    );
  }
  }
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
