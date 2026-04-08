import os
import subprocess


def save_code_context(output_file: str):
    def run_command(command):
        result = subprocess.run(command, shell=True, text=True, capture_output=True)
        return result.stdout.strip()

    def get_git_root():
        result = subprocess.run(["git", "rev-parse", "--show-toplevel"], text=True, capture_output=True, check=True)
        return result.stdout.strip()

    def clean_notebook_diff(file_path):
        """Runs nbconvert to remove metadata and outputs from a Jupyter Notebook file."""
        command = (
            "nbconvert --ClearOutputPreprocessor.enabled=True --ClearMetadataPreprocessor.enabled=True "
            "--to=notebook --stdin --stdout --log-level=ERROR"
        )

        with open(file_path, "r") as f:
            result = subprocess.run(command, input=f.read(), shell=True, text=True, capture_output=True)

        return result.stdout

    git_log_command = "git log -1"
    git_log_output = run_command(git_log_command)

    # Run `git diff` and capture the output
    git_diff_command = "git diff --name-only"
    changed_files = run_command(git_diff_command).split("\n")

    git_root = get_git_root()
    # Process only `.ipynb` files to remove metadata & outputs
    cleaned_files = {}
    for file in changed_files:
        if file.endswith(".ipynb"):
            cleaned_files[file] = clean_notebook_diff(os.path.join(git_root, file))

    # Run `git diff`
    git_diff_command_full = "git diff"
    git_diff_output = run_command(git_diff_command_full)

    with open(output_file, "w") as file:
        file.write(f"Command: {git_log_command}\n")
        file.write(f"Output:\n{git_log_output}\n\n")
        file.write(f"Command: {git_diff_command_full}\n")
        # Write the original diff but replace `.ipynb` diffs with cleaned versions
        for line in git_diff_output.split("\n"):
            if line.startswith("diff --git") and line.endswith(".ipynb"):
                notebook_path = line.split(" ")[-1]  # Extract notebook filename
                file.write(f"{line}\n")
                file.write(cleaned_files.get(notebook_path, "[Notebook cleaned]\n"))
            else:
                file.write(f"{line}\n")


def save_context(output_file: str):
    save_code_context(output_file)
