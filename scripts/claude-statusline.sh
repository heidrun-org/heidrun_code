#!/bin/sh
# Heidrun Code — status line for Claude Code.
#
# 1. Prints a compact line at the bottom of Claude Code (model · context · quotas).
# 2. When Claude runs inside a Herdr pane, reports the same numbers to Herdr as
#    pane tokens, which Heidrun Code (and Herdr's own sidebar) can display.
#
# Installed by Heidrun Code (Panneau → « Activer le suivi Claude ») as
# ~/.config/heidrun_code/claude-statusline.sh. If you already had a status line, its
# command is saved in ~/.config/heidrun_code/claude-statusline-next and still drives
# what Claude Code displays: this script only adds the report to Herdr.
# Requires jq (shipped with macOS 15+, otherwise `brew install jq`).

input=$(cat)

get() {
  printf '%s' "$input" | jq -r "$1 // empty" 2>/dev/null
}

model=$(get '.model.display_name')
# used_percentage is null until the first answer of a session (right after /clear
# for instance): that is an empty context, not "unknown", so it reports 0 instead of
# leaving the previous session's figure in place.
ctx=$(get '.context_window.used_percentage // (if .context_window then 0 else empty end)')
sid=$(get '.session_id')
ctx_size=$(get '.context_window.context_window_size')
q5=$(get '.rate_limits.five_hour.used_percentage')
q5_reset=$(get '.rate_limits.five_hour.resets_at')
q7=$(get '.rate_limits.seven_day.used_percentage')
q7_reset=$(get '.rate_limits.seven_day.resets_at')
cost=$(get '.cost.total_cost_usd')

round() {
  [ -n "$1" ] && printf '%.0f' "$1" 2>/dev/null
}

# ---- Report to Herdr (in the background, never slows the status line) -------
if [ -n "$HERDR_PANE_ID" ]; then
  herdr_bin=${HERDR_BIN_PATH:-herdr}
  if command -v "$herdr_bin" >/dev/null 2>&1; then
    set -- --source user:heidrun --token "hd_ts=$(date +%s)"
    [ -n "$model" ] && set -- "$@" --token "hd_model=$model"
    [ -n "$sid" ] && set -- "$@" --token "hd_sid=$sid"
    [ -n "$ctx" ] && set -- "$@" --token "hd_ctx=$(round "$ctx")"
    [ -n "$ctx_size" ] && set -- "$@" --token "hd_ctx_size=$ctx_size"
    # Each window carries the time it was read, so the app can tell a fresh value
    # from one left over by an earlier report of the same session.
    now=$(date +%s)
    [ -n "$q5" ] && set -- "$@" --token "hd_q5h=$(round "$q5")" --token "hd_q5h_ts=$now"
    [ -n "$q5_reset" ] && set -- "$@" --token "hd_q5h_reset=$q5_reset"
    [ -n "$q7" ] && set -- "$@" --token "hd_q7d=$(round "$q7")" --token "hd_q7d_ts=$now"
    [ -n "$q7_reset" ] && set -- "$@" --token "hd_q7d_reset=$q7_reset"
    [ -n "$cost" ] && set -- "$@" --token "hd_cost=$cost"
    ("$herdr_bin" pane report-metadata "$HERDR_PANE_ID" "$@" >/dev/null 2>&1 &)
  fi
fi

# ---- The line shown in Claude Code -----------------------------------------
desk_dir="${HEIDRUN_CODE_DIR:-${HEIDRUN_DIR:-}}"
if [ -z "$desk_dir" ]; then
	desk_dir="$HOME/.config/heidrun_code"
	if [ ! -d "$desk_dir" ] && [ -d "$HOME/.config/heidrun" ]; then
		desk_dir="$HOME/.config/heidrun"
	fi
fi
# "Masquer dans le terminal" in Heidrun Code: print nothing, the app shows the numbers.
if [ -e "$desk_dir/claude-statusline-hidden" ]; then
  exit 0
fi
# Your own status line, if you had one, keeps the display.
next_file="$desk_dir/claude-statusline-next"
if [ -s "$next_file" ]; then
  printf '%s' "$input" | sh -c "$(cat "$next_file")"
  exit $?
fi

line=""
[ -n "$model" ] && line="$model"
[ -n "$ctx" ] && line="$line · contexte $(round "$ctx")%"
[ -n "$q5" ] && line="$line · 5h $(round "$q5")%"
[ -n "$q7" ] && line="$line · semaine $(round "$q7")%"
printf '%s\n' "${line# · }"
