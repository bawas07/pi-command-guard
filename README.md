# command-guard

A Pi coding agent extension that guards against dangerous bash commands and protects sensitive files from accidental modification.

## Features

### 🛡 Dangerous Command Guard
Intercepts bash tool calls and prompts for confirmation before executing risky commands:

- `rm -rf` / `rm -fr` — recursive force delete
- `DROP TABLE`, `DROP DATABASE`, `TRUNCATE TABLE` — SQL destruction
- `git push --force` / `git push -f` — force push (rewrites history)
- `chmod -R 777` / `chmod 777` — world-write permissions
- `> /dev/sda`, `dd if=` — disk overwrite / raw disk operations
- `mkfs` — filesystem format
- `:(){:|:&};:` — fork bomb
- `shutdown`, `reboot` — system shutdown/reboot
- `kill -9 1` — kill init process
- `sudo ` — superuser execution

### 🔒 Protected File Guard
Intercepts write and edit tool calls on sensitive files:

- `.env` files and variants (`.env.local`, `.env.prod`, etc.)
- Secrets files (`secrets.json`, `secrets.yaml`, `credentials.json`, etc.)
- Certificate/key files (`.pem`, `.key`, `.p12`, `.pfx`, `.crt`, `.cer`)
- SSH private keys (`id_rsa`, `id_ed25519`, `id_ecdsa`)
- `.kubeconfig` files
- `node_modules/` directory
- `.git/objects/` directory

### 📊 Status Indicators
Shows thinking level and current model in the footer status bar.

### ⌨ Keyboard Shortcut
- `Ctrl+Shift+L` — Toggle between moonfang dark/light themes

### 📋 Slash Commands
- `/guard-status` — Display all active dangerous patterns and protected file patterns

## Install

### From GitHub

```bash
pi install git:github.com/bawas07/pi-command-guard
```

Pin to a specific version:

```bash
pi install git:github.com/bawas07/pi-command-guard@v1.0.0
```

### From npm (coming soon)

```bash
pi install npm:command-guard
```

### Local development

```bash
pi install ./path/to/command-guard
```

## Uninstall

```bash
pi remove git:github.com/bawas07/pi-command-guard
```

## License

MIT
