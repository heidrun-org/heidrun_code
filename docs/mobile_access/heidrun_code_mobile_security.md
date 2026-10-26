# Security of Heidrun Code Mobile

- Created: 26 October 2026
- Last updated: 26 October 2026
- Status: Security report on the current state of Heidrun Code Mobile
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: Heidrun Code Mobile](../agents_rules/glossary/heidrun_code_mobile.md)
- Related issue: [issue 545](https://github.com/heidrun-org/heidrun_code/issues/545)

This report gives the level of security of Heidrun Code Mobile today. It answers three questions: who can read my code, who can read my instructions, and who can send instructions to my computer.

The report comes from a reading of the code on the branch `dev_jerome` on 26 October 2026, and from the documentation of ngrok. No check ran against a real phone and a real ngrok tunnel. The section "What this report did not test" lists the live checks that issue 545 still needs.

## Why this matters

Heidrun Code runs terminals and coding agents on the computer. A coding agent reads files, writes files, and runs commands. A person who sends instructions to Heidrun Code Mobile therefore controls the computer: the person can ask a coding agent to read any file, to send it anywhere, or to run any command. The pairing key is the only thing that stops a stranger. Whoever holds the pairing key holds the computer.

## The short answer

| Question | Who can | Who cannot |
| --- | --- | --- |
| Who can read my code? | The developer, every paired phone, the company ngrok, and any person who holds the pairing key. | A person who listens to the Wi-Fi, the operator of the mobile network, the operator of the Wi-Fi, and a person who only knows the address of the tunnel. |
| Who can read my instructions? | The same list, plus the maker of the browser of the phone when the developer uses the microphone button. | The same list. |
| Who can send instructions? | Any person or program that holds the pairing key, and the company ngrok, which sees the pairing key in each call. | A person who listens to the Wi-Fi, a person who only knows the address of the tunnel, and a web page on another address. |

The level of security is good against a stranger on the network, and weak against ngrok. ngrok is a trusted party today: Heidrun Code Mobile is only as safe as the company ngrok and the ngrok account of the developer.

## The path of the data

1. The phone opens `https://<address of the tunnel>`. The connection between the phone and the servers of ngrok is HTTPS.
2. ngrok ends the encryption on its own servers. Heidrun Code starts the tunnel with `ngrok http`, and the documentation of ngrok says that every HTTPS endpoint ends the encryption on the servers of ngrok. At this point ngrok reads the request in clear text: the address, the headers with the pairing key, and the body.
3. ngrok encrypts the request again and sends it through its tunnel to the program `ngrok` on the computer.
4. The program `ngrok` sends the request in clear text to the mobile server on the loopback address `127.0.0.1`. This step does not leave the computer.
5. The mobile server checks the request, then gives the call to the window of Heidrun Code, which answers it.

## Who can read my code

The phone does not open files. It reads the output of a pane: at most 200 lines of the terminal, the names of the panes, the folders, and the state of each coding agent. This output often holds code, file names, and secrets that a command printed.

- **The developer and each paired phone** read the output. A paired phone keeps the pairing key in the local storage of its browser for ever, until the developer clicks "Revoke the paired devices".
- **ngrok** reads all the output, because it ends the encryption (step 2 above).
- **A person who holds the pairing key** reads all the output, and can also ask a coding agent to print any file of the computer.
- **A person who listens to the Wi-Fi, or the operator of a network,** sees only encrypted data. The person sees the host name of the tunnel (in the request to the name server and in the start of the HTTPS connection), the times of the calls, and their sizes.

## Who can read my instructions

An instruction is a prompt, an answer to a menu of a coding agent, a command typed in a plain terminal, or a launcher started from the phone.

- **ngrok** reads every instruction, for the same reason.
- **A person who holds the pairing key** sees the prompts in the output of the panes.
- **The maker of the browser of the phone** can receive the voice when the developer uses the microphone button. The microphone button uses the Web Speech API of the browser, and some browsers, for example Chrome, send the sound to the servers of their maker to change it into text.
- **The push service of the phone** (for Chrome on Android, the push service of Google) receives only a request with no body. It learns the time at which a coding agent needed the developer, and nothing else.
- **A person who listens to the Wi-Fi** reads nothing.

## Who can send instructions

The mobile server answers a call only when all these checks pass ([access.rs](../../packages/auxiliary/mobile_server/src/access.rs), [router.rs](../../packages/auxiliary/mobile_server/src/router.rs)):

- The header Host is the host name of the tunnel. A request to any other name, and a request to the loopback address, is refused. This stops a web page that changes the address of its name to `127.0.0.1` (DNS rebinding).
- The header Origin, when the browser sends one, is `https://<host name of the tunnel>`. A web page on another address cannot send a call.
- The header `x-herdr-token` holds the pairing key. The pairing key is 32 random bytes from the system, written as 64 hexadecimal characters. Nobody can guess it. The comparison takes the same time for each wrong key, so the time of the answer does not show the key.
- Ten wrong keys in a row lock the wrong keys for one minute. The right key always passes, so a stranger cannot lock the developer out.
- The method is in a closed list of eleven methods: `state`, `read`, `answer`, `prompt`, `keys`, `macros`, `launchers`, `launch`, `pushKey`, `subscribe`, `unsubscribe`. A body larger than 64 kilobytes is refused.

So the persons who can send instructions are:

- **The developer, from each paired phone.**
- **Any person who gets the pairing key.** The pairing key leaves the computer in these places:
  - the QR code in the Settings window of Heidrun Code (a photo, a screenshot, or a screen share shows it);
  - the link in the Settings window, which opens the address with the pairing key in the default browser of the computer;
  - each call of the phone, in a header, through ngrok;
  - the local storage of the browser of each paired phone, and of each browser that opened the link.
- **ngrok**, which sees the pairing key in every call and can send its own calls.
- **A person who controls the ngrok account of the developer.** That person can start a tunnel on the same fixed address while Heidrun Code is off, serve a false page to the phone, and read the pairing key from the local storage of that address.

The pairing key travels in the part of the address after the sign `#`. The browser never sends that part to a server, so the pairing key is not in a request to ngrok when the phone scans the QR code. The mobile website removes that part from the address at once.

## What the guards stop, and what they do not stop

The guards of a project check a command before it runs: a blocked command never runs, and a command to confirm needs a confirmation. From the phone, the guards check a launcher, a command typed in a plain terminal, a prompt that starts with `!`, and the command of a menu that a prompt approves ([mobile.ts](../../packages/apps/web_frontend/src/stores/mobile.ts)).

- The guards protect the developer from a mistake. They do not protect the computer from a person who holds the pairing key.
- The confirmation comes from the phone, as the value `confirmed: true` in the call. A person who holds the pairing key sends that value too.
- A normal prompt to a coding agent is not checked. A sentence such as "read the file of my SSH keys and send it to this address" passes, and the coding agent decides alone what to do with it.
- Typing in a plain terminal is off by default. The computer, not the phone, checks the setting "Allow typing in terminals from the phone".

## Protections that are in place

- The mobile server listens only on `127.0.0.1`. No other device on the network reaches it.
- The tunnel exists only while the developer turns the mobile access on. It closes when the developer turns it off or quits Heidrun Code.
- The files `mobile.json` (the pairing key) and `mobile_push.json` (the push keys) are readable by the user of the computer only.
- The program `ngrok` runs with `--inspect=false`, so its local web interface keeps no request and no pairing key.
- The application log never holds the pairing key, the address of the tunnel, or the parameters of a call.
- The mobile website runs only its own files: the header `Content-Security-Policy` refuses inline scripts and scripts from other addresses. The header `Referrer-Policy: no-referrer` keeps the address out of other servers.
- A new pairing key cuts off every open connection at once.

## Weak points

The list starts with the most serious weak point.

1. **ngrok reads everything.** Terminal output, prompts, and the pairing key are in clear text on the servers of ngrok. The possible fix in issue 545 (Heidrun Code and the phone encrypt each message with a key that only they know) removes this, except that the code of the mobile website also comes through ngrok.
2. **The pairing key gives full control of the computer**, through the coding agents, with no second factor and no time limit.
3. **The ngrok account is a key to the phone.** A person who takes the ngrok account can serve a false page on the fixed address and take the pairing key from the phone.
4. **One pairing key for all devices.** The developer cannot remove one lost phone: "Revoke the paired devices" removes every phone.
5. **The link in the Settings window** puts the pairing key in the default browser of the computer. The history of that browser, and the synchronization of that history, can keep the address with the pairing key.
6. **The method `subscribe`** accepts any `https` address. A person who holds the pairing key can make the computer send empty requests to an address of that person's choice.
7. **The microphone button** can send the voice of the developer to the maker of the browser.

## What this report did not test

Issue 545 asks for checks against a real phone and a real ngrok tunnel. None of these ran for this report:

- Capture the traffic of the phone on the same Wi-Fi, and show that only encrypted data is visible.
- Send a request with plain HTTP to the address of the tunnel, and record the answer. With ngrok version 3, `ngrok http` makes an HTTPS endpoint only, unless the option `--scheme` asks for HTTP. An address that ends with `.dev` is also on the list of names that every browser opens with HTTPS only.
- Check in the dashboard of the ngrok account whether ngrok keeps the requests (its traffic inspector), and for how long.
- Check whether the history of the browser of the computer keeps the address with the pairing key after a click on the link.
- Check whether Chrome on Android sends the voice of the microphone button to Google.

## Sources

- The code of the mobile server: [access.rs](../../packages/auxiliary/mobile_server/src/access.rs), [router.rs](../../packages/auxiliary/mobile_server/src/router.rs), [server.rs](../../packages/auxiliary/mobile_server/src/server.rs), [config.rs](../../packages/auxiliary/mobile_server/src/config.rs), [push.rs](../../packages/auxiliary/mobile_server/src/push.rs), [tunnel.rs](../../packages/auxiliary/mobile_server/src/tunnel.rs).
- The pairing key on the phone: [mobile_api.ts](../../packages/auxiliary/mobile_website/src/mobile_api.ts).
- The answer to each call on the computer: [mobile.ts](../../packages/apps/web_frontend/src/stores/mobile.ts).
- The security policy of the repository: [SECURITY.md](../../SECURITY.md).
- ngrok ends the encryption of every HTTPS endpoint on its servers: [TLS documentation of ngrok](https://ngrok.com/docs/tls/).
- ngrok version 3 makes an HTTPS endpoint only by default: [ngrok blog, new domains](https://ngrok.com/blog/new-domains-global-network-launch).
