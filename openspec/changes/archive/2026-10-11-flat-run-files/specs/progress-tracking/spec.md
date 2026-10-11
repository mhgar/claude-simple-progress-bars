## MODIFIED Requirements

### Requirement: Watched directories
The plugin MUST list `<config>/progress` every 250 ms, with `<config>` from `CLAUDE_CONFIG_DIR`, else `HOME`, else `USERPROFILE`, and `/.claude` after the last two. It MUST read only the files whose names start with one of its session IDs and `.`. It MUST read a file again only when its modification time changes. It MUST NOT write or delete any file. After `/clear` or `/resume`, it MUST add the new session ID and keep the earlier ones.

#### Scenario: Clear
- **WHEN** a background wrapper writes a run file with the old session ID, and the user runs `/clear`
- **THEN** the bars of that wrapper stay

#### Scenario: A file of an earlier version
- **WHEN** `<config>/progress` holds a session directory of version 1.2.4, with a `.owner` file or run files
- **THEN** the plugin reads none of them, and shows no bar for them

#### Scenario: A file of another session
- **WHEN** `<config>/progress` holds a run file of another session
- **THEN** the plugin does not read it, and shows no bar for it

#### Scenario: A session ID that starts another
- **WHEN** the session ID is `abc`, and `<config>/progress` holds `abc-2.4242-1700000000`
- **THEN** the plugin does not read that file
