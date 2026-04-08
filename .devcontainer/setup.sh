#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

PGHOST=localhost
PGPORT=5432
PGUSER=ai
PGPASSWORD=human
PGDATABASE=lumiflowdb
PGADMIN_DATABASE=postgres

COLOR_INFO="\033[1;34m"
COLOR_WARN="\033[1;33m"
COLOR_SUCCESS="\033[1;32m"
COLOR_RESET="\033[0m"

log_info() {
  echo -e "${COLOR_INFO}$1${COLOR_RESET}"
}

log_warn() {
  echo -e "${COLOR_WARN}$1${COLOR_RESET}"
}

log_success() {
  echo -e "${COLOR_SUCCESS}$1${COLOR_RESET}"
}

wait_for_postgres() {
  until PGPASSWORD="$PGPASSWORD" psql --host=$PGHOST --port=$PGPORT --username=$PGUSER --dbname=$PGADMIN_DATABASE -c '\q'; do
    >&2 log_warn "Postgres is unavailable - sleeping"
    sleep 1
  done
}

ensure_database_exists() {
  local exists
  exists=$(PGPASSWORD="$PGPASSWORD" psql --host=$PGHOST --port=$PGPORT --username=$PGUSER --dbname=$PGADMIN_DATABASE --tuples-only --no-align --command="SELECT 1 FROM pg_database WHERE datname = '$PGDATABASE';")

  if [ "$exists" != "1" ]; then
    log_info "Creating database $PGDATABASE ..."
    PGPASSWORD="$PGPASSWORD" createdb --host=$PGHOST --port=$PGPORT --username=$PGUSER $PGDATABASE
  fi
}

ensure_docker_daemon() {
  if docker info >/dev/null 2>&1; then
    return
  fi

  local containerd_version
  containerd_version=$(dpkg-query -W -f='${Version}' moby-containerd 2>/dev/null || true)

  if [[ "$containerd_version" == 2.3.0* ]]; then
    log_warn "moby-containerd $containerd_version is incompatible with this Docker-in-Docker setup; pinning 2.2.3 ..."
    sudo apt-get install -y --allow-downgrades moby-containerd=2.2.3-debian12u1
    sudo apt-mark hold moby-containerd
  fi

  log_info "Starting Docker daemon ..."
  sudo /usr/local/share/docker-init.sh true
}

log_info "Starting setup script..."
REPO_ROOT="$(pwd)"

log_info "Configuring nvm auto-switching..."
cat >> ~/.bashrc << 'EOF'

# Auto-switch Node version when entering a directory with .nvmrc
load-nvmrc() {
  local nvmrc_path="$(nvm_find_nvmrc)"
  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version=$(nvm version "$(cat "${nvmrc_path}")")
    if [ "$nvmrc_node_version" = "N/A" ]; then
      nvm install
    elif [ "$nvmrc_node_version" != "$(nvm version)" ]; then
      nvm use
    fi
  fi
}
PROMPT_COMMAND="load-nvmrc; ${PROMPT_COMMAND}"
EOF

log_info "Installing dependencies..."
sudo apt-get update
sudo apt-get install -y git-lfs openjdk-17-jdk-headless python3.11 python3-pip pipx postgresql 
ensure_docker_daemon
pipx install uv
source /usr/local/share/nvm/nvm.sh

log_info "Installing AWS CLI..."
tmpdir=$(mktemp -d)
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "$tmpdir/awscliv2.zip"
unzip "$tmpdir/awscliv2.zip" -d "$tmpdir"
sudo "$tmpdir/aws/install" --update
rm -rf "$tmpdir"
echo "AWS CLI installed. You may configure it with 'aws configure'."

DATABASE_STARTED=false

if [ -d "$REPO_ROOT/backend" ]; then
  log_info "Setting up backend ..."
  cd "$REPO_ROOT/backend"
  nvm install
  npm install
  npm run build
  if [ "$DATABASE_STARTED" != true ]; then
    npm run dev:services
    DATABASE_STARTED=true
  fi
  wait_for_postgres
  ensure_database_exists
  npm run db:migrate
  cd "$REPO_ROOT"
  echo "Backend setup completed. You may run it with 'npm run dev' inside the backend directory."
else
  log_warn "Skipping backend setup because backend/ is not checked out."
fi

if [ -d "$REPO_ROOT/job-service" ]; then
  log_info "Setting up job service ..."
  cd "$REPO_ROOT/job-service"
  nvm install
  npm install
  npm run build
  if [ "$DATABASE_STARTED" != true ]; then
    npm run dev:docker
    DATABASE_STARTED=true
  fi
  wait_for_postgres
  ensure_database_exists
  npm run db:migrate
  cd "$REPO_ROOT"
  echo "Job service setup completed. You may run it with 'npm run dev' inside the job-service directory."
else
  log_warn "Skipping job service setup because job-service/ is not checked out."
fi

if [ -d "$REPO_ROOT/frontend" ]; then
  log_info "Setting up frontend ..."
  cd "$REPO_ROOT/frontend"
  nvm install
  npm install
  cd "$REPO_ROOT"
  echo "Frontend setup completed. You may run it with 'npm run dev' inside the frontend directory."
else
  log_warn "Skipping frontend setup because frontend/ is not checked out."
fi

if [ -d "$REPO_ROOT/inference" ]; then
  log_info "Setting up inference..."
  cd "$REPO_ROOT/inference"
  uv sync --all-packages
  bash scripts/install-git-hooks.sh
  cd "$REPO_ROOT"
  echo "Inference setup completed. You may run it with 'uv run eval_service' inside the inference directory."
else
  log_warn "Skipping inference setup because inference/ is not checked out."
fi

if [ -f "$REPO_ROOT/scripts/install-git-hooks.sh" ]; then
  bash "$REPO_ROOT/scripts/install-git-hooks.sh"
fi

log_success "Setup script completed."
