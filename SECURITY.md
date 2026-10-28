# Security Policy

Even Valhalla has a gate to guard. Heidrun Code can reach your terminals, your agents, and, with the mobile access feature, your phone. We take security seriously.

## Supported versions

Only the latest version of Heidrun Code receives security fixes.

## Report a vulnerability

Do **not** open a public issue for a vulnerability. A public report gives the trolls a map.

1. Go to the [Security tab](https://github.com/heidrun-org/heidrun_code/security) of the repository.
2. Choose "Report a vulnerability" to open a private report.
3. Describe the problem: what you did, what happened, and which version of Heidrun Code and macOS you use.

If you cannot use the Security tab, contact the maintainers [Eric Defiez](https://github.com/edefiez) and [Jérôme Étienne](https://github.com/jeromeetienne) through GitHub and ask for a private way to send the report.

## What happens next

- We confirm that we received the report.
- We investigate, and we keep you informed.
- We publish a fix, and we thank you in the release notes if you want.

## Good to know

The mobile access puts a small server on the public Internet, through an ngrok tunnel. Only the pairing key and the checks of the request headers protect it. Anyone who has the pairing key can control your coding agents from anywhere.

- The mobile server listens only on the loopback address `127.0.0.1` of your computer, so no other device on your network reaches it. The program `ngrok` runs on your computer and forwards the requests of the tunnel to it. Heidrun Code starts `ngrok` with the option `--inspect=false`, so the local web interface of `ngrok` does not remember the requests, and the pairing keys in them.
- The pairing key has 64 hexadecimal characters. Each request needs it, and ten wrong keys in a row lock the wrong keys for one minute.
- The server answers only a request whose header Host is the host name of the tunnel, and whose header Origin, when there is one, is the page of the tunnel. A request to any other name, and a request to the loopback address, is refused even with the right key.
- ngrok ends the encryption on its own servers. ngrok can read the traffic of the tunnel, and the pairing key in it.
- The tunnel needs a free ngrok account. Its address is fixed for the account: it is the same each time that the tunnel opens, so it stays known and public. The pairing key is the only secret. The QR code holds the address and the pairing key: do not show it, and do not share it. The button "Revoke the paired devices" makes a new key, and keeps the address.
- The first time that a browser opens the address, ngrok shows a warning page of the free plan. That page also shows the public network address of your computer to the visitor.
- The tunnel opens when you turn the mobile access on, and closes when you turn it off or quit Heidrun Code. A crash of Heidrun Code can leave the program `ngrok` running. It then holds the address of your account, and the next tunnel fails with the message that the address is in use, until you close that program.

A report that shows a way around these protections is very welcome. The mead stays inside the cauldron.
