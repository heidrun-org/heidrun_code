# Glossary of Heidrun Code: Heidrun Code Mobile

- Created: 16 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [User interface of Heidrun Code Mobile](../user_interface/heidrun_code_mobile/screens.md)
- Related issue: [issue 581](https://github.com/heidrun-org/heidrun/issues/581)

This document gives one short definition for each word of Heidrun Code Mobile. The other words of Heidrun Code are in [index.md](index.md).

### Heidrun Code Mobile

The second front end of Heidrun Code: a mobile website on the phone that controls the coding agents that run on the computer. See [mobile_access.md](../../mobile_access/mobile_access.md).

### Mobile website

The page that the phone opens, in the package `packages/auxiliary/mobile_website`. It talks only to the mobile server.

### Mobile server

The Rust library in the package `packages/auxiliary/mobile_server` that the desktop application starts. It serves the files of the mobile website, checks the pairing key, and accepts only a closed list of methods.

### Pairing key

The secret that the QR code gives to the phone. The phone sends it with each call, and the mobile server refuses a call without it.

### Bottom bar

The row of four buttons at the bottom of the mobile website: Dashboard, Needs you, Panes, and Launchers.

### Plain terminal on the phone

A pane in which no coding agent runs. The phone lists it with the badge "Terminal" and shows its output. The phone types in it only when the setting "Allow typing in terminals from the phone" is on and the developer says yes in the warning sheet, and every command passes the guards.

### Macro button

The button with a lightning in the top bar of the screen of one pane. A tap opens the list of the macros of the pane, and a tap on a macro writes its text into the field for a prompt.

### Microphone button

The button next to the field for a prompt on the screen of one pane. A tap starts to listen, and the words go into the field for a prompt. A second tap stops to listen.

## Rules

- Write "Heidrun Code Mobile", "mobile website", and "mobile server" in full. Do not write "the app", "the PWA", or "the mobile" for one of them.
- Write "phone", never "iPhone", and "computer", never the name of one brand of computer.
