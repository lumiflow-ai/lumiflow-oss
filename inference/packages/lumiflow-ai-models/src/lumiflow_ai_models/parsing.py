"""Functions for parsing JSON strings into Python dictionaries and Pydantic models."""

import inspect
import json
from typing import Dict, Type, get_args, get_origin, List, Union

import json_repair
from pydantic import BaseModel, create_model

# noinspection PyProtectedMember
from pydantic.fields import FieldInfo


class ParserError(Exception):
    pass


def get_example_dict_recursive(model_class: Type[BaseModel]) -> dict:
    """
    Get an example dictionary for a model, recursively.
    Note: This function does not return a JSON string, but a Python dictionary.
    Args:
        model_class: the model class to get an example for. The model's fields should have an `example` attribute.
    Returns:
        a dictionary with example values for the model's fields.
    """

    def get_example(field: FieldInfo):
        if field.examples:
            return field.examples[0]

        if get_origin(field.annotation) is list:
            inner_type = get_args(field.annotation)[0]
            if issubclass(inner_type, BaseModel):
                return [get_example_dict_recursive(inner_type)]
            else:
                return [inner_type() if callable(inner_type) else None]

        if issubclass(field.annotation, BaseModel):
            return get_example_dict_recursive(field.annotation)

        raise ParserError(f"Some fields of model {model_class.__name__} have no examples")

    # noinspection PyUnresolvedReferences
    example_data = {field_name: get_example(field_info) for field_name, field_info in model_class.model_fields.items()}
    return example_data


def serialize_model(model_class: Type[BaseModel]) -> str:
    """
    Get a JSON string with an example dictionary for a model, recursively.
    Args:
        model_class: the model class to get an example for. The model's fields should have an `example` attribute.
    Returns:
        a JSON string with example values for the model's fields.
    """
    return json.dumps(get_example_dict_recursive(model_class), indent=4)


def prompt_for_model(model_class: Type[BaseModel]) -> str:
    """
    Get a prompt for a model class whose answer can be parsed.
    Args:
        model_class: the model class to get a prompt for.
    Returns:
        a prompt string.
    """
    return f"Answer in JSON with the following format:\n{serialize_model(model_class)}"


def extract_last_json(text: str) -> str:
    """ "
    Find the first JSON object in a string.
    Args:
        text: the string to search.
    Returns:
        the last JSON object found.
    Raises:
        ParserError: if no JSON object is found in the string.
    """
    start_idx = -1
    brace_count = 0
    in_string = False
    escape = False

    for i, char in enumerate(text):
        if char == '"' and not escape:
            in_string = not in_string
        elif char in "{[" and not in_string:
            if start_idx == -1:
                start_idx = i
            brace_count += 1
        elif char in "}]" and not in_string:
            brace_count -= 1
            if brace_count == 0:
                json_str = text[start_idx:i + 1]  # fmt: skip
                return json_str
        escape = char == "\\" and not escape

    raise ParserError("No JSON found in text", text)


def parse_dict(text: str) -> Dict[str, any]:
    """
    Parse a JSON string into a dictionary.
    Args:
        text: the JSON string.
    Returns:
        a dictionary with the JSON data.
    Raises:
        ParserError: if the string is empty, not a string, or not a JSON dictionary.
    """
    if not text:
        raise ParserError("Empty argument")
    if not isinstance(text, str):
        raise ParserError(f"Argument is not a string ({type(text)}): {text}")
    result = json_repair.loads(extract_last_json(text))
    if not isinstance(result, dict):
        raise ParserError(f"String is not a JSON dictionary ({type(result)}): {text}")
    return result


def parse_model(text: str, model_class: Type[BaseModel]) -> BaseModel:
    """
    Parse a JSON string into a Pydantic model.
    Args:
        text: the JSON string.
        model_class: the Pydantic model class to parse the data into.
    Returns:
        a Pydantic model instance.
    Raises:
        ParserError: if the string is empty, not a string, or not a JSON dictionary.
    """
    return model_class(**parse_dict(text))


def strip_model(original_model: Type[BaseModel], new_name: str = None, description: str = None) -> Type[BaseModel]:
    """
    Dynamically creates a new Pydantic BaseModel from an existing one,
    stripping all Pydantic-specific Field metadata (like 'examples', 'description').
    This is useful for generating JSON schemas compatible with LLM APIs that
    don't understand Pydantic-specific Field arguments (e.g. google genai).
    Args:
        original_model: The original Pydantic model class.
        new_name: The name for the new dynamically created model. Defaults to original_model.__name__ + "Stripped".
        description: An optional description for the new model's JSON schema.
    Returns:
        Type[BaseModel]: A new Pydantic BaseModel class suitable for GenAI response_schema.
    """
    fields = {}
    for field_name, field_info in original_model.model_fields.items():
        field_type = field_info.annotation
        field_default = field_info.default

        # --- Recursive logic for nested Pydantic models ---
        origin_type = get_origin(field_type)
        args = get_args(field_type)

        if origin_type is list and args:
            # Check if the list's element type is a BaseModel
            list_element_type = args[0]
            if inspect.isclass(list_element_type) and issubclass(list_element_type, BaseModel):
                stripped_nested_model = strip_model(list_element_type)
                fields[field_name] = (List[stripped_nested_model], field_default)
            else:
                # If not a BaseModel, keep the original type
                if field_info.is_required:
                    fields[field_name] = (field_type, ...)
                else:
                    fields[field_name] = (field_type, field_default)
        elif origin_type is Union and args:
            # Filter out non-class types (like NoneType) before checking issubclass
            base_model_args = [arg for arg in args if inspect.isclass(arg) and issubclass(arg, BaseModel)]

            if base_model_args:
                # Assuming there's only one BaseModel type within the Union for simplicity
                # If multiple BaseModel types are in the Union, this logic might need refinement
                nested_base_model_type = base_model_args[0]
                stripped_nested_model = strip_model(nested_base_model_type)

                # Reconstruct the Union with the stripped type
                # Collect all non-BaseModel arguments from the original Union
                other_args = tuple(arg for arg in args if arg is not nested_base_model_type)

                # Construct the tuple of arguments for Union explicitly
                union_args = (stripped_nested_model,) + other_args
                fields[field_name] = (Union[union_args], field_default)
            else:
                # If no BaseModel found in Union, keep the original type
                if field_info.is_required:
                    fields[field_name] = (field_type, ...)
                else:
                    fields[field_name] = (field_type, field_default)
        elif inspect.isclass(field_type) and issubclass(field_type, BaseModel):
            # Handle direct NestedModel -> StrippedNestedModel
            stripped_nested_model = strip_model(field_type)
            fields[field_name] = (stripped_nested_model, field_default)
        else:
            # For non-Pydantic types, keep as is
            if field_info.is_required:
                fields[field_name] = (field_type, ...)  # Use Ellipsis for required fields
            else:
                fields[field_name] = (field_type, field_default)

    # Set the new model name
    if new_name is None:
        new_name = original_model.__name__ + "Stripped"

    # Create the new model dynamically
    new_model = create_model(new_name, **fields)

    # Determine the module name for the new model
    frame = inspect.currentframe().f_back
    if frame:
        module_name = frame.f_globals["__name__"]
    else:
        module_name = __name__

    new_model.__module__ = module_name
    new_model.__qualname__ = new_name

    # Add model_config for JSON schema description if provided
    if description:
        new_model.model_config = {"json_schema_extra": {"description": description}}

    return new_model


def unstrip_model_instance(stripped_instance: BaseModel, original_model_class: Type[BaseModel]) -> BaseModel:
    """
    Converts an instance of a stripped Pydantic model (used for LLM schema)
    back into an instance of the original, full-featured Pydantic model.
    Args:
        stripped_instance: An instance of the dynamically created stripped model.
        original_model_class: The class of the original Pydantic model.
    Returns:
        BaseModel: An instance of the original Pydantic model with values set.
    """
    if isinstance(stripped_instance, BaseModel):
        data_dict = stripped_instance.model_dump()
        return original_model_class.model_validate(data_dict)
    return stripped_instance
