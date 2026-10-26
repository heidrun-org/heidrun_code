# Mobile access

- Created: 12 October 2026
- Last updated: 16 October 2026
- Status: Maintained description of Heidrun Code Mobile
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: Heidrun Code Mobile](../agents_rules/glossary/heidrun_code_mobile.md), [User interface of Heidrun Code Mobile](../agents_rules/user_interface/heidrun_code_mobile/screens.md)
- Related issue: [issue 274](https://github.com/heidrun-org/heidrun/issues/274), [issue 581](https://github.com/heidrun-org/heidrun/issues/581)

Mobile access is a finished feature of Heidrun Code. The developer opens a mobile website on a phone, and keeps the coding agents working while away from the desk. The coding agents keep running on the computer. The phone is a remote control: it reads, answers, and starts things, and it keeps no work of its own. The product name of the feature is Heidrun Code Mobile. The idea comes from the meeting notes in [issue #274](https://github.com/heidrun-org/heidrun/issues/274).

## How it works

- The mobile website, in the package [mobile_website](../../packages/auxiliary/mobile_website/CONTEXT.md), is the page of the phone. It talks only to the mobile server.
- The mobile server, in the package [mobile_server](../../packages/auxiliary/mobile_server/CONTEXT.md), is a Rust library that the desktop application starts. It serves the files of the mobile website, checks the pairing key, and accepts only a closed list of methods.
- Each call of the phone reaches the web front end of the desktop application through the event `mobile-call`. The file [mobile.ts](../../packages/apps/web_frontend/src/stores/mobile.ts) answers it with the same data and the same guards as the desktop window.
- The developer turns the feature on in the section "Mobile access" of the Settings window. Heidrun Code then shows a QR code. The QR code holds the public address and the pairing key. The camera of the phone scans it once, and the phone keeps the pairing key. A new pairing key cuts off every paired phone.

## The relationship with ngrok

The mobile server listens on the loopback address of the computer only, so nothing on the network reaches it. A phone away from the desk needs a public address, and [ngrok](https://ngrok.com) gives it.

- Heidrun Code starts the program `ngrok` as `ngrok http 127.0.0.1:<port>`. The developer installs `ngrok` and signs in to it once. Heidrun Code does not install it, and it tells the developer when `ngrok` is missing or not signed in.
- The account of the developer has a fixed public `https` address. The phone keeps the same address for ever, and the QR code is scanned once.
- The tunnel only carries the bytes to the loopback address. The mobile server still refuses every request whose header Host is not the host name of the tunnel, whose header Origin is wrong, or that has no right pairing key. Ten wrong keys lock the wrong keys for one minute, and never the right key.
- Heidrun Code closes the tunnel when it quits, when the developer turns the feature off, and when it replaces the program. It starts `ngrok` with its local web interface off, so the pairing key stays out of it.
- The free plan of ngrok shows a warning page the first time that a browser opens the address. For this reason the page is not a progressive web application: the warning page replaces the manifest and the icons, and Chrome on Android cannot install the page. The developer adds a shortcut to the Home Screen of the phone instead.
- No private network is built in. A developer who wants one installs it without the help of Heidrun Code.

## What the phone can do

The rules of each screen are in [the user interface of Heidrun Code Mobile](../agents_rules/user_interface/heidrun_code_mobile/screens.md).

- The Dashboard shows how many coding agents need the developer, how many work, and the usage limits. Its gear button opens the settings window of the phone, with the notifications.
- The Needs you screen lists the coding agents that wait for the developer, and the developer answers a menu, refuses, or interrupts.
- The Panes screen lists every pane of every workspace, plain terminals included.
- The screen of one pane shows the output of the pane with its colors. A coding agent takes a prompt, and a plain terminal is read only by default.
- The macro button in the top bar of the screen of one pane writes the text of a macro into the field for a prompt. The text goes out only when the developer taps Send.
- The microphone button fills the field for a prompt from the voice, with the Web Speech API of the browser. A browser without it shows no microphone button.
- The Launchers screen runs or stops a launcher of a project on the computer.
- A plain terminal takes typing only when the setting "Allow typing in terminals from the phone" is on in Heidrun Code, and the developer confirms each time that a terminal is opened.

## The guards

A prompt, a macro, an answer to a menu, a launcher, and a command typed in a plain terminal from the phone pass the same guards as on the desktop. When the guards want a confirmation, the computer sends the command to the phone, and the phone asks the developer. A command that the project blocks never runs. [Issue 589](https://github.com/heidrun-org/heidrun/issues/589) tracks the documentation of the guards.

## Notifications

Only Chrome on Android shows a notification, in a normal tab, through a service worker on an `https` address. A phone that is not Android shows a notification only from an installed progressive web application, so it has no notification here.

- The gear button of the Dashboard opens the settings window. There the developer allows the notifications, turns the push on or off, and sends a test notification.
- The server makes a key once and keeps it in the file `mobile_push.json`, readable by this user only. The phone asks for the key with the method `pushKey`, asks its browser for a push subscription, and gives the address of the push service to the server with the method `subscribe`.
- When a coding agent asks a question, finishes, or is blocked, and it is not in the quiet hours (the focus of the window and the open pane do not matter, because a phone is for a developer who is away), the window of Heidrun Code calls the command `mobile_push`, which does nothing while the mobile access is off. The server sends a request with no body to each phone, so the push service learns nothing about the coding agent.
- The service worker shows the fixed text "A coding agent needs you." A tap opens the screen Needs you.

## What stays out

Heidrun Code Mobile does not show the Source control sidebar section, the Past chats sidebar section, the Clipboard sidebar section, the Settings window of the computer, the tab bar, the layout of several panes, or the pinned panes. The developer does these things at the desk.

## What is not done

- The push needs a live test on a real Android phone ([issue 581](https://github.com/heidrun-org/heidrun/issues/581)).
- The microphone needs a live test on a real phone through the ngrok address. When the Web Speech API does not work, the microphone key of the keyboard of the phone is the fallback.
