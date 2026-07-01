# Deploy-user least privilege (sudoers)

Restricts the CI/SSH deployment account to only the container-lifecycle commands it needs,
instead of granting it host-wide `root` or Docker-group (root-equivalent) access.

## Threat model
The deploy workflow (`.github/workflows/deploy.yml`, `appleboy/ssh-action`) SSHes in as
`DEPLOY_SSH_USER` and runs `git pull`, `docker compose … up -d --build`, and `docker image prune`.
If that account is in the `docker` group or has blanket `sudo`, a leaked SSH key = full root on
the VM. This drop-in narrows what the key can do.

> **Honest caveat:** *any* ability to run `docker`/`docker compose` is powerful — a compose file
> the user controls can mount host paths. This is defense-in-depth (blocks arbitrary
> `docker run -v /:/host`, `apt`, editing system files, etc.), not a hard root boundary. Combine
> with a locked-down deploy key and branch protection on `main`.

## Install (on the VM, as root)
1. Edit `ops/sudoers/mediflow-deploy`: replace `deploy` with your real `DEPLOY_SSH_USER` and the
   `/home/deploy/ICT2216_P2_Grp17` paths with your `DEPLOY_PATH`.
2. Take the deploy user OUT of the `docker` group (so Docker is only reachable via these sudo rules):
   ```bash
   sudo gpasswd -d deploy docker   # if it was added
   ```
3. Install + validate the drop-in:
   ```bash
   sudo install -m 440 -o root -g root ops/sudoers/mediflow-deploy /etc/sudoers.d/mediflow-deploy
   sudo visudo -cf /etc/sudoers.d/mediflow-deploy   # must print "parsed OK"
   ```

## Update the deploy workflow to use sudo
After installing, the deploy commands must be prefixed with `sudo` (matching the alias exactly).
In `.github/workflows/deploy.yml` the `script:` becomes:
```bash
set -e
cd "$DEPLOY_PATH"
sudo /usr/bin/git -C "$DEPLOY_PATH" pull --ff-only
sudo /usr/bin/docker compose -f "$DEPLOY_PATH/docker-compose.prod.yml" --env-file "$DEPLOY_PATH/.env.production" up -d --build
sudo /usr/bin/docker image prune -f
```
The commands must match the `Cmnd_Alias` byte-for-byte (same flags/paths) or sudo will deny them.

## Rollback
Remove the drop-in and (if desired) re-add the docker group:
```bash
sudo rm /etc/sudoers.d/mediflow-deploy
```
