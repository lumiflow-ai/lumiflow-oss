"""Module to create and load configuration variables from Python files."""

import importlib.util
import os
import sys
import types
from pathlib import Path


def create(defaults: dict = None) -> types.ModuleType:
    """
    Creates a new module to store configuration variables.
    Args:
        defaults (dict, optional): Default values to inject.
    Returns:
        types.ModuleType: The new module.
    Example:
        Passing defaults as a dict:
        ```
        config = configuration.create(defaults={"A": 1, "B": 2})
        config.load("config.py")
        print(config.A, config.B)
        ```
    Example:
        Passing defaults as properties:
        ```
        config = configuration.create()
        config.A = 1
        config.B = 2
        config.load("config.py")
        print(config.A, config.B)
        ```
    """

    class ConfigModule(types.ModuleType):
        """Custom config module with a meaningful __repr__ method."""

        def __repr__(self):
            """Returns a string representation of the current configuration."""
            return f"<Config {self.to_dict()}>"

        def to_dict(self):
            """Returns a dict representation of the current configuration."""
            return {
                k: v
                for k, v in vars(self).items()
                if not k.startswith("__") and not callable(v)  # Filter out built-ins and methods
            }

        def __getattr__(self, name):
            return None

        def save(self, config_path):
            """Saves the configuration variables to a Python file.
            Args:
                config_path (str): Path to the Python config file.
            """
            with open(config_path, "w") as file:
                for key, value in vars(self).items():
                    if not key.startswith("__") and not callable(value):
                        file.write(f"{key}: {value}\n")

    config = ConfigModule("config")

    # Inject default values
    if defaults:
        for key, value in defaults.items():
            setattr(config, key, value)

    def load(config_path):
        # Check if config file exists
        if os.path.isfile(config_path):
            sys.path.insert(0, str(Path(config_path).resolve().parent))
            spec = importlib.util.spec_from_file_location("config", config_path)
            new_config = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(new_config)  # Execute the config file

            # Update the config module, keeping defaults when values are missing
            for key, value in vars(new_config).items():
                setattr(config, key, value)

        else:
            print(f"Warning: Config file '{config_path}' not found, using defaults.")

    config.load = load
    return config


def load(config_path: str, defaults: dict = None) -> types.ModuleType:
    """Dynamically loads a Python config file as a module. If the file does not exist, use only defaults.
    Args:
        config_path (str): Path to the Python config file.
        defaults (dict, optional): Default values to inject.
    Returns:
        types.ModuleType: The loaded module containing config variables.
    """
    config = create(defaults)
    config.load(config_path)
    return config
