#!/bin/sh
# Installs the latest Heidrun Code in the Applications folder, with no message "damaged" from macOS.
# curl -fsSL https://raw.githubusercontent.com/heidrun-org/heidrun_code/main/scripts/install.sh | sh
#
# The command line tool curl does not put the quarantine mark com.apple.quarantine on a file that it downloads.
# macOS checks the signature of an application only when the application has this mark.
#
# The variable HEIDRUN_CODE_APPLICATIONS_FOLDER changes the folder that receives Heidrun Code.app. The default is /Applications.
# The tests use it to install in a temporary folder.

set -eu

DMG_URL="https://github.com/heidrun-org/heidrun_code/releases/latest/download/Heidrun_Code_aarch64.dmg"
APPLICATIONS_FOLDER="${HEIDRUN_CODE_APPLICATIONS_FOLDER:-/Applications}"
APP_PATH="${APPLICATIONS_FOLDER}/Heidrun Code.app"
WORK_FOLDER=""
MOUNT_FOLDER=""

fail() {
	echo "Error: $1" >&2
	exit 1
}

cleanup() {
	if [ -n "${MOUNT_FOLDER}" ] && [ -d "${MOUNT_FOLDER}" ]; then
		hdiutil detach "${MOUNT_FOLDER}" -quiet >/dev/null 2>&1 || true
	fi
	if [ -n "${WORK_FOLDER}" ] && [ -d "${WORK_FOLDER}" ]; then
		rm -rf "${WORK_FOLDER}"
	fi
}

if [ "$(uname -s)" != "Darwin" ]; then
	fail "Heidrun Code runs only on macOS. This computer is not a Mac."
fi

if [ "$(uname -m)" != "arm64" ]; then
	fail "Heidrun Code has a disk image only for Apple silicon. This Mac does not have an Apple silicon processor."
fi

if pgrep -f "${APP_PATH}/Contents/MacOS/" >/dev/null 2>&1; then
	fail "Heidrun Code is running. Quit Heidrun Code, then run this command again."
fi

if [ ! -w "${APPLICATIONS_FOLDER}" ]; then
	fail "This user cannot write in the folder ${APPLICATIONS_FOLDER}."
fi

trap cleanup EXIT
trap 'exit 1' HUP INT TERM

WORK_FOLDER="$(mktemp -d "${TMPDIR:-/tmp}/heidrun_install.XXXXXX")"
DMG_PATH="${WORK_FOLDER}/Heidrun_Code_aarch64.dmg"
MOUNT_FOLDER="${WORK_FOLDER}/mount"

echo "Downloading the latest Heidrun Code."
curl -fL -o "${DMG_PATH}" "${DMG_URL}"

mkdir "${MOUNT_FOLDER}"
hdiutil attach -nobrowse -readonly -mountpoint "${MOUNT_FOLDER}" "${DMG_PATH}" >/dev/null </dev/null

if [ ! -d "${MOUNT_FOLDER}/Heidrun Code.app" ]; then
	fail "The disk image does not contain Heidrun Code.app."
fi

echo "Installing Heidrun Code in ${APPLICATIONS_FOLDER}."
rm -rf "${APP_PATH}"
ditto "${MOUNT_FOLDER}/Heidrun Code.app" "${APP_PATH}"

BIN_FOLDER="${HOME}/.local/bin"
mkdir -p "${BIN_FOLDER}"
for COMMAND in heidrun_code_ctrl heidrun_data; do
	SOURCE="${APP_PATH}/Contents/Resources/binaries/${COMMAND}"
	TARGET="${BIN_FOLDER}/${COMMAND}"
	if [ ! -x "${SOURCE}" ]; then
		fail "The application does not contain the command line ${COMMAND}."
	fi
	if [ -e "${TARGET}" ] || [ -L "${TARGET}" ]; then
		if [ -L "${TARGET}" ] && [ "$(readlink "${TARGET}")" = "${SOURCE}" ]; then
			continue
		fi
		fail "${TARGET} already exists and is not the Heidrun Code command line."
	fi
	ln -s "${SOURCE}" "${TARGET}"
done

hdiutil detach "${MOUNT_FOLDER}" -quiet >/dev/null
MOUNT_FOLDER=""

VERSION="$(sed -n '/CFBundleShortVersionString/{n;s/.*<string>\(.*\)<\/string>.*/\1/p;}' "${APP_PATH}/Contents/Info.plist")"
echo "Heidrun Code ${VERSION} is installed in ${APP_PATH}."
echo "The commands heidrun_code_ctrl and heidrun_data are available in ${BIN_FOLDER}."
