# Heidrun Code Mobile source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/heidrun_code_mobile.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of Heidrun Code Mobile. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

- Glossary entry: [Heidrun Code Mobile](../../glossary/heidrun_code_mobile.md#11-heidrun-code-mobile).
- Proposed destinations: Glossary, System Overview, Platform Support.

#### Heidrun Code Mobile

The second front end of Heidrun Code: a mobile website on the phone that controls the coding agents that run on the computer. See [mobile_access.md](../../../mobile_access/mobile_access.md).

### Source line 16

- Glossary entry: [Mobile website](../../glossary/heidrun_code_mobile.md#12-mobile-website).
- Proposed destinations: Glossary, System Overview, Technical documentation.

#### Mobile website

The page that the phone opens, in the package `packages/auxiliary/mobile_website`. It talks only to the mobile server.

### Source line 20

- This passage is preserved as repository or technical terminology.
- Proposed destinations: System Overview · Server responsibilities, Behaviour, Technical documentation.

#### Mobile server

The Rust library in the package `packages/auxiliary/mobile_server` that the desktop application starts. It serves the files of the mobile website, checks the pairing key, and accepts only a closed list of methods.

### Source line 24

- Glossary entry: [Pairing key](../../glossary/heidrun_code_mobile.md#13-pairing-key).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Pairing key

The secret that the QR code gives to the phone. The phone sends it with each call, and the mobile server refuses a call without it.

### Source line 28

- Glossary entry: [Bottom bar](../../glossary/heidrun_code_mobile.md#14-bottom-bar).
- Proposed destinations: Glossary, User Interface.

#### Bottom bar

The row of four buttons at the bottom of the mobile website: Dashboard, Needs you, Panes, and Launchers.

### Source line 32

- Glossary entry: [Plain terminal on the phone](../../glossary/heidrun_code_mobile.md#15-plain-terminal-on-the-phone).
- Proposed destinations: Glossary, User Interface, Behaviour, Platform Support.

#### Plain terminal on the phone

A pane in which no coding agent runs. The phone lists it with the badge "Terminal" and shows its output. The phone types in it only when the setting "Allow typing in terminals from the phone" is on and the developer says yes in the warning sheet, and every command passes the guards.

### Source line 36

- Glossary entry: [Macro button](../../glossary/heidrun_code_mobile.md#16-macro-button).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Macro button

The button with a lightning in the top bar of the screen of one pane. A tap opens the list of the macros of the pane, and a tap on a macro writes its text into the field for a prompt.

### Source line 40

- Glossary entry: [Microphone button](../../glossary/heidrun_code_mobile.md#17-microphone-button).
- Proposed destinations: Glossary, User Interface, Behaviour, Platform Support.
- Inventory notes: Keep distinct from the desktop push-to-talk button.

#### Microphone button

The button next to the field for a prompt on the screen of one pane. A tap starts to listen, and the words go into the field for a prompt. A second tap stops to listen.

### Source line 44

#### Rules

### Source line 46

- Proposed destinations: Glossary.

- Write "Heidrun Code Mobile", "mobile website", and "mobile server" in full. Do not write "the app", "the PWA", or "the mobile" for one of them.

### Source line 47

- Proposed destinations: Glossary.
- Inventory notes: Preserve the source terminology guidance and review where the rule should apply.

- Write "phone", never "iPhone", and "computer", never the name of one brand of computer.
