# User interface of Heidrun Code: system notification and sound of each kind of notification

- Created: 24 October 2026
- Last updated: 24 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [Information card of every option of the Settings window](settings_information_cards.md)
- Related issue: [issue 857](https://github.com/heidrun-org/heidrun_code/issues/857)

This file is a part of the rules of the user interface of Heidrun Code. It gives the rules of the rows of the Notifications section of the Settings window that choose the system notification and the sound of each kind of notification.

## The kinds of notification

- Heidrun Code sends nine kinds of notification, in this order: a pane is blocked, a pane asks a question, a pane finishes, a pane stays blocked for too long, the context of an agent is almost full, the quota of Claude is almost used, the monthly budget of a workspace is almost used, a watched pattern is found, and the summary of the day.
- The list of the kinds is `NOTIFICATION_KINDS` in `lib/notification_channels.ts`. Every call of the function `notify` of `lib/notify.ts` gives one kind as its first argument. A new notification adds its kind to the list, a row to the section, and a text in both languages.

## The rows

- Under the heading "System notification and sound for each kind", the Notifications section has one Bootstrap list group with a border and rounded corners (never `list-group-flush`), after the quiet hours and before the status item, with one row for each kind. Each row is a `list-group-item list-group-item-action`, so it gets the soft background `--hover-soft` while the pointer is over it, like the rows of the other list groups ([sidebars_appearance.md](../../web_styling/sidebars_appearance.md)). A row has three lines. The first line has the name of the kind, the circled question mark with an information card in English and in French right after the name, and the button "Test" at the right end. The second line has the Bootstrap switch "System notification". The third line has the Bootstrap switch "Sound" and the list of sounds. The row has `data-option="notificationChannel"`.
- "System notification" is on at first, because every kind sent a system notification before the rows existed. "Sound" is off at first, so that nobody hears a new sound after an update.
- The list holds the 14 system sounds of macOS: Basso, Blow, Bottle, Frog, Funk, Glass, Hero, Morse, Ping, Pop, Purr, Sosumi, Submarine, and Tink. The first value is Ping for every kind. No sound file is shipped. The application plays the sound itself: the Rust command `play_system_sound` of `system_sound.rs` starts the program `afplay` of macOS for one of the 14 names and refuses any other name. The system notification carries no sound, because in development macOS shows the notification as a notification of Terminal, and a sound that depends on the banner stayed silent.
- When "System notification" is off, the switch "Sound", the list, and the button "Test" of the row are disabled. When "Sound" is off, the list is disabled.
- The settings are saved in the option `notificationChannels` of `stores/settings.ts`. `NotificationChannels.keep` replaces a saved field of the wrong type, and a sound that macOS does not have, by the default value.

## What a notification does

- `notify` shows nothing in the quiet hours and nothing when "System notification" of its kind is off. It plays the chosen sound, through `play_system_sound`, only when "Sound" of its kind is on, and the sound plays even when macOS does not show the banner.
- The existing options `notifBlockedMin`, `notifContext`, `notifQuota`, and `notifEvening` decide whether an event happens. The rows decide only how the event reaches the developer.

## The button "Test"

- The button shows one real system notification of the kind of its row, with a fixed example text and the settings of the row, and it plays the chosen sound when "Sound" is on. The function is `notifyTest` of `lib/notify.ts`.
- The button ignores the quiet hours, because the developer asked for the test. It asks for the permission of macOS when the permission is not granted yet.

## The tests

- `lib/notification_channels.test.ts`, `lib/notify.test.ts`, `stores/settings.test.ts`, and `components/settings/SettingsNotificationsSection.test.ts` check the rules above with a fake notification plugin and a fake `play_system_sound`. The Rust tests of `system_sound.rs` start `afplay` at volume 0, so no test plays an audible sound.
