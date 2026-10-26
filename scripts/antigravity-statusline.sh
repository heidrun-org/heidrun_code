#!/bin/bash
# Heidrun Code — reports Antigravity account quota to the active Herdr pane.
# The Antigravity status line still displays the user's former status line, or
# the built-in line when there was no former command.

input=$(cat)

get() {
  printf '%s' "$input" | jq -r "$1 // empty" 2>/dev/null
}

if [ -n "$HERDR_PANE_ID" ]; then
  herdr_bin=${HERDR_BIN_PATH:-herdr}
  if command -v "$herdr_bin" >/dev/null 2>&1; then
    count=$(get '.quota | length')
    case "$count" in ''|*[!0-9]*) count=0 ;; esac
    [ "$count" -gt 20 ] && count=20
    now=$(date +%s)
    set -- --source user:heidrun --token "hd_agy_ts=$now" --token "hd_agy_count=$count"
    model=$(get '.model.display_name')
    context=$(get '.context_window.used_percentage')
    context_size=$(get '.context_window.context_window_size')
    session=$(get '.conversation_id // .session_id')
    [ -n "$model" ] && set -- "$@" --token "hd_agy_model=$model"
    [ -n "$context" ] && set -- "$@" --token "hd_agy_ctx=$context"
    [ -n "$context_size" ] && set -- "$@" --token "hd_agy_ctx_size=$context_size"
    [ -n "$session" ] && set -- "$@" --token "hd_agy_sid=$session"
    index=0
    while [ "$index" -lt "$count" ]; do
      id=$(get ".quota | to_entries | sort_by(.key) | .[$index].key")
      remaining=$(get ".quota | to_entries | sort_by(.key) | .[$index].value.remaining_fraction")
      reset=$(get ".quota | to_entries | sort_by(.key) | .[$index].value.reset_time")
      [ -n "$id" ] && set -- "$@" --token "hd_agy_${index}_id=$id"
      [ -n "$remaining" ] && set -- "$@" --token "hd_agy_${index}_remaining=$remaining"
      [ -n "$reset" ] && set -- "$@" --token "hd_agy_${index}_reset=$reset"
      index=$((index + 1))
    done
    ("$herdr_bin" pane report-metadata "$HERDR_PANE_ID" "$@" >/dev/null 2>&1 &)
  fi
fi

desk_dir="${HEIDRUN_CODE_DIR:-${HEIDRUN_DIR:-}}"
if [ -z "$desk_dir" ]; then
	desk_dir="$HOME/.config/heidrun_code"
	if [ ! -d "$desk_dir" ] && [ -d "$HOME/.config/heidrun" ]; then
		desk_dir="$HOME/.config/heidrun"
	fi
fi
next_file="$desk_dir/antigravity-statusline-next"
if [ -s "$next_file" ]; then
  printf '%s' "$input" | sh -c "$(cat "$next_file")"
fi
