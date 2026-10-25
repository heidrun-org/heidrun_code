#!/bin/sh
set -eu

ROOT_FOLDER="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
COMMANDS_FOLDER="${ROOT_FOLDER}/packages/apps/desktop_tauri/target/release/bundled_commands"
TAURI_CONFIGURATION_FILE="${ROOT_FOLDER}/packages/apps/desktop_tauri/tauri.conf.json"

# The release build of the application (tauri build) sets MACOSX_DEPLOYMENT_TARGET to the value of
# minimumSystemVersion. The tools share the folder target/release with the application, so they use the same value.
# With another value, each build compiles again the dependencies that the other build compiled (issue 877).
if [ -z "${MACOSX_DEPLOYMENT_TARGET:-}" ]; then
	MINIMUM_SYSTEM_VERSION="$(sed -n 's/.*"minimumSystemVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${TAURI_CONFIGURATION_FILE}")"
	if [ -n "${MINIMUM_SYSTEM_VERSION}" ]; then
		export MACOSX_DEPLOYMENT_TARGET="${MINIMUM_SYSTEM_VERSION}"
	fi
fi

(cd "${ROOT_FOLDER}/packages/auxiliary/heidrun_code_ctrl" && cargo build --release)
(cd "${ROOT_FOLDER}/packages/data_layers/heidrun_code_data" && cargo build --release)

# The build script of the application watches the bundled tools. A copy gives a tool a new date, and the application
# is then compiled again, so a tool is copied only when its content changed (issue 877).
mkdir -p "${COMMANDS_FOLDER}"
for TOOL_NAME in heidrun_code_ctrl heidrun_code_data; do
	BUILT_TOOL="${ROOT_FOLDER}/packages/apps/desktop_tauri/target/release/${TOOL_NAME}"
	if ! cmp -s "${BUILT_TOOL}" "${COMMANDS_FOLDER}/${TOOL_NAME}"; then
		cp "${BUILT_TOOL}" "${COMMANDS_FOLDER}/${TOOL_NAME}"
	fi
done
