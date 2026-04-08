"""
A tracker to measure the cost of running the notebook, loading the LLM in memory, LLM generations.
Provides a pricing data loader to load the pricing information for the models and the instance.
"""

import glob
import os
import time
from collections import namedtuple
from dataclasses import dataclass
from enum import Enum
from importlib import resources

import humanize
import pandas as pd
from colorama import Fore, Style

from lumiflow_core.measure import seconds_to_human


class CostType(Enum):
    """The billing type of cost being tracked."""

    TIME = "time"
    TOKEN = "token"


class Type(Enum):
    """The type of event being tracked for cost."""

    NOTEBOOK = "notebook"
    LOADING = "loading"
    GENERATE = "generate"


class Status(Enum):
    """The status of the event."""

    SUCCESS = "success"
    FAIL = "fail"


class Tracker:
    def __init__(
        self,
        instance_id: str | None,
        pricing: dict = None,
        use_human_format: bool = False,
        egress_rate: float = 0.09,
        raise_on_error: bool = False,
    ):
        """Initialize the cost tracker.
        Args:
            instance_id: The ID of the instance running the notebook, e.g. 'sagemaker/ml.p4d.24xlarge';
            or None for no time-based cost tracking ($0.0).
            pricing: An optional dictionary with the pricing information for the models and the instance, if it is not
            yet included in this package's pricing data. The format is:
            ```{
                "provider/instance_id": {
                    "hourly_cost": 0.0,
                },
                "provider/model_id": {
                    "input_cost": 0.0,
                    "output_cost": 0.0,
                },
            }
            ```
            use_human_format: Whether to output times in seconds or in a human-readable format.
            raise_on_error: Whether to raise an exception if an error occurs.
        """
        self.instance_id = instance_id
        pricing_data = PricingDataLoader.get_data()
        self.pricing = {**pricing_data, **(pricing or {})}
        self.use_human_format = use_human_format
        self.egress_rate = egress_rate
        self.raise_on_error = raise_on_error
        self.log = []
        self._error = False

    def _t(self, seconds: float) -> str:
        """Convert seconds to a human-readable format if needed."""
        if self.use_human_format:
            return seconds_to_human(seconds)
        return f"{seconds:.2f}s"

    @staticmethod
    def _s(
        df: pd.DataFrame,
        key: str,
    ):
        """Return a string with the statistics of a dataframe."""
        return (
            f"min={df[key].min()} avg={df[key].mean()} med={df[key].median()} std={df[key].std()} max={df[key].max()}"
        )

    def _st(
        self,
        df: pd.DataFrame,
        key: str,
    ) -> str:
        """Return a string with the statistics of a dataframe, with time in a human format if needed."""
        return (
            f"{self._t(df[key].sum())} ("
            f"min={self._t(df[key].min())} "
            f"avg={self._t(df[key].mean())} "
            f"med={self._t(df[key].median())} "
            f"std={self._t(df[key].std())} "
            f"max={self._t(df[key].max())}"
            ")"
        )

    @staticmethod
    def _h(header: str = ""):
        """Print a header."""
        print(Fore.BLUE + "---" + header + "---" + Style.RESET_ALL)

    def _e(self, message: str):
        """Print an error message or raise an exception if needed."""
        self._error = True
        if self.raise_on_error:
            raise ValueError(message)
        else:
            print(Fore.RED + "Error: " + message + Style.RESET_ALL)

    @dataclass
    class Context:
        log_entry: dict = None

    def notebook_start(self, context: Context = None) -> Context:
        """
        Start the timer for running the notebook.
        Args:
            context: a context to use, otherwise the function will create a new context.
        Returns:
            A context object that should be passed to the notebook_end function.
        """
        context = context or self.Context()
        context.log_entry = context.log_entry or {}
        context.log_entry["type"] = Type.NOTEBOOK
        context.log_entry["cost_type"] = CostType.TIME
        context.log_entry["start_time"] = time.perf_counter()
        self.log.append(context.log_entry)
        return context

    def notebook_end(self, context: Context):
        """
        End the timer for running the notebook.
        Args:
            context: the context object returned by the notebook_start function.
        """
        end_time = time.perf_counter()
        if not isinstance(context.log_entry, dict):
            raise Exception("Invalid log entry")
        context.log_entry["end_time"] = end_time

    def loading_start(
        self,
        model_id: str,
        model_class: str = None,
        context: Context = None,
    ) -> Context:
        """
        Start the timer for loading the LLM in memory.
        This function is typically not called directly, but called by model objects.
        Args:
            model_id: the model ID of the model; e.g. "mistral.mistral-small"
            model_class: the class of the model that is being loaded, e.g. "bedrock".
            context: a context to use, otherwise the function will create a new context.
        Returns:
            A context object that should be passed to the load_end function.
        """
        context = context or self.Context()
        context.log_entry = context.log_entry or {}
        context.log_entry["type"] = Type.LOADING
        context.log_entry["model_class"] = model_class
        context.log_entry["model_id"] = model_id
        context.log_entry["cost_type"] = CostType.TIME
        context.log_entry["start_time"] = time.perf_counter()
        self.log.append(context.log_entry)
        return context

    def loading_end(self, context: Context):
        """
        End the timer for loading the LLM in memory.
        This function is typically not called directly, but called by model objects.
        Args:
            context: the context object returned by the load_start function.
        """
        end_time = time.perf_counter()
        if not isinstance(context.log_entry, dict):
            raise Exception("Invalid log entry")
        context.log_entry["end_time"] = end_time

    def generate_start(
        self,
        cost_type: CostType,
        model_id: str,
        model_class: str = None,
        context: Context = None,
    ) -> Context:
        """
        Start the timer for generating a response with the LLM.
        This function is typically not called directly, but called by model objects.
        Args:
            cost_type: The cost type of the generation, either "time" or "token".
            model_id: the model ID of the model; e.g. "mistral.mistral-small".
            model_class: the class of the model that is generating the response, e.g. "bedrock".
            context: a context to use, otherwise the function will create a new context.
        Returns:
            A context object to be passed to the generate_end function.
        """
        context = context or self.Context()
        context.log_entry = context.log_entry or {}
        context.log_entry["type"] = Type.GENERATE
        context.log_entry["model_class"] = model_class
        context.log_entry["model_id"] = model_id
        context.log_entry["cost_type"] = cost_type
        context.log_entry["start_time"] = time.perf_counter()
        self.log.append(context.log_entry)
        return context

    def generate_end(
        self,
        context: Context,
        input_tokens: int = None,
        output_tokens: int = None,
        message_size_bytes: int = None,
        status: Status = None,
        error: str = None,
        extra_data: dict = None,
    ):
        """
        End the timer for generating a response with the LLM.
        This function is typically not called directly, but called by model objects.
        Args:
            context: the context object returned by the generate_start function.
            input_tokens: the number of tokens provided as prompt to the LLM.
            output_tokens: the number of tokens in the response generated by the LLM.
            message_size_bytes: the size of the response in bytes.
            status: the status of the generation, either "succeeded" or "failed".
            error: an error message if the generation failed, otherwise None.
            extra_data: any extra data to store in the log
        """
        if not isinstance(context.log_entry, dict):
            raise Exception("Invalid log entry")
        context.log_entry["end_time"] = time.perf_counter()
        context.log_entry["input_tokens"] = input_tokens
        context.log_entry["output_tokens"] = output_tokens
        context.log_entry["message_size_bytes"] = message_size_bytes
        context.log_entry["status"] = status
        context.log_entry["error"] = error
        for k, v in (extra_data or {}).items():
            key = f"extra_{k}" if k in context.log_entry.keys() else k
            context.log_entry[key] = v

    def dataframe(self) -> pd.DataFrame:
        """
        Return a dataframe with the LLM generations.
        Returns:
            the dataframe.
        """
        df = pd.DataFrame(self.log)

        required_columns = [
            "type",
            "start_time",
            "end_time",
            "cost_type",
            "input_tokens",
            "output_tokens",
            "message_size_bytes",
            "status",
        ]
        for column in required_columns:
            if column not in df.columns:
                df[column] = pd.NA

        df["duration"] = df["end_time"] - df["start_time"]
        df["minute_bucket"] = (df[df["type"] == Type.GENERATE]["start_time"] // 60).astype(int)
        df["total_tokens"] = df["input_tokens"] + df["output_tokens"]
        return df

    def instance_hourly_cost(self) -> float:
        """
        Returns the hourly cost of the instance running the notebook.
        """
        if self.instance_id is None:
            return 0
        if self.pricing is None:
            self._e(
                "No pricing information available."
                "Either pass `pricing` to the Tracker constructor or update the pricing tsv files."
            )
        if self.instance_id not in self.pricing:
            self._e(
                f"Pricing information is not available for instance {self.instance_id}. "
                f"Either pass `pricing` to the Tracker constructor or update the pricing tsv files."
            )
        return self.pricing.get(self.instance_id, {}).get("hourly_cost", 0)

    def pricing_for_model(
        self,
        model_id: str,
    ) -> dict:
        """Returns the pricing information for a given model id."""
        if self.pricing is None:
            self._e(
                "No pricing information available. "
                "Either pass `pricing` to the Tracker constructor or update the pricing tsv files."
            )
        for k, v in self.pricing.items():
            if model_id.startswith(k):
                return v
        self._e(
            f"Pricing information is not available for {model_id}. "
            f"Either pass `pricing` to the Tracker constructor or update the pricing tsv files."
        )
        return {}

    def notebook_duration(self) -> float | None:
        """
        Returns the duration of the notebook execution.
        If multiple executions are detected, returns the duration of the last one.
        """
        df = self.dataframe()
        df_notebook = df[df["type"] == Type.NOTEBOOK]
        if not df_notebook.empty:
            if df_notebook.shape[0] > 1:
                self._e("Multiple notebook executions detected. Using the last one.")
            return df_notebook.sort_values(by="end_time").tail(1)["duration"].sum()
        return None

    def generate_duration(self) -> float | None:
        """
        Returns the total duration of all LLM generations.
        If multiple executions are detected, return the sum of all durations.
        """
        df = self.dataframe()
        df_generate = df[df["type"] == Type.GENERATE]
        if not df_generate.empty:
            return df_generate["duration"].sum()
        return None

    def cost(self, print_details: bool = True, export: str = None) -> (float, float):
        """
        Calculates the cost of running the notebook, loading the LLM in memory, LLM generations and API calls.
        Args:
            print_details: whether to print the cost details.
            export: filepath where to export the cost details in CSV format.
        Returns:
            the total cost.
        """
        df = self.dataframe()

        if not df[df["cost_type"] == CostType.TIME].empty:
            instance_hourly_cost = self.instance_hourly_cost()
        else:
            instance_hourly_cost = 0

        # Notebook cost
        notebook_duration = self.notebook_duration()
        notebook_cost = 0
        if notebook_duration is not None:
            notebook_cost = notebook_duration * instance_hourly_cost / 3600
            if print_details:
                self._h("Notebook cost")
                print(f"Instance cost: ${instance_hourly_cost:.2f} per hour")
                print(f"Notebook execution duration: {self._t(notebook_duration)}")
                print(f"Notebook execution cost: ${notebook_cost:.2f}")

        # Time-based cost
        load_duration = 0
        generate_duration = 0
        time_cost = 0
        df_loading = df[(df["cost_type"] == CostType.TIME) & (df["type"] == Type.LOADING)]
        df_generate = df[(df["cost_type"] == CostType.TIME) & (df["type"] == Type.GENERATE)]
        if not df_loading.empty or not df_generate.empty:
            load_duration = df_loading["duration"].sum()
            generate_duration = df_generate["duration"].sum()
            time_cost = (load_duration + generate_duration) * instance_hourly_cost / 3600
            if print_details:
                self._h("Time-based cost")
                print(f"Instance cost: ${instance_hourly_cost:.2f} per hour")
                print(f"Loading duration: {self._t(load_duration)}")
                print(f"Generate duration: {self._st(df_generate, 'duration')}")
                print(f"Generate count: {df_generate.shape[0]}")
                df_succeeded = df_generate[df_generate["status"] == Status.SUCCESS]
                percentage_succeeded = (
                    (df_succeeded.shape[0] / df_generate.shape[0]) * 100 if df_generate.shape[0] > 0 else 0
                )
                print(f"Successful generate count: {df_succeeded.shape[0]} ({percentage_succeeded}%)")
                print(f"Total time-based cost: ${time_cost:.6f}")

        # Token-based cost
        input_cost = 0
        output_cost = 0
        token_cost = 0
        df_token = df[df["cost_type"] == CostType.TOKEN]
        df_token_succeeded = df_token[df_token["status"] == Status.SUCCESS]
        if not df_token_succeeded.empty:
            grouped_sum = df_token_succeeded.groupby("model_id")["input_tokens"].sum()
            input_cost = (
                grouped_sum
                * grouped_sum.index.map(lambda x: self.pricing_for_model(x).get("input_cost", 0))
                / 1_000_000
            )
            grouped_sum = df_token_succeeded.groupby("model_id")["output_tokens"].sum()
            output_cost = (
                grouped_sum
                * grouped_sum.index.map(lambda x: self.pricing_for_model(x).get("output_cost", 0))
                / 1_000_000
            )
            token_cost = (input_cost + output_cost).sum()
            if print_details:
                self._h("Token-based cost")
                for model_id in df_token["model_id"].unique():
                    m_input_tokens = df_token_succeeded[df_token["model_id"] == model_id]["input_tokens"].sum()
                    m_output_tokens = df_token_succeeded[df_token["model_id"] == model_id]["output_tokens"].sum()
                    m_pricing = self.pricing_for_model(model_id)
                    m_input_pricing = m_pricing.get("input_cost", 0)
                    m_output_pricing = m_pricing.get("output_cost", 0)
                    m_input_cost = m_input_tokens * m_input_pricing / 1_000_000
                    m_output_cost = m_output_tokens * m_output_pricing / 1_000_000
                    print(
                        f"Model {model_id}:"
                        f"\n\t{m_input_tokens} input tokens at ${m_input_pricing:.6f}/M, "
                        f"{m_output_tokens} output tokens at ${m_output_pricing:.6f}/M"
                        f"\n\t= ${m_input_cost:.6f} + ${m_output_cost:.6f}"
                        f"\n\t= ${m_input_cost + m_output_cost:.6f}"
                    )
                print(f"Input tokens cost: ${input_cost.sum():.6f}")
                print(f"Output tokens cost: ${output_cost.sum():.6f}")
                print(f"Generate count: {df_token.shape[0]}")
                percentage_succeeded = (
                    df_token_succeeded.shape[0] / df_token.shape[0] * 100 if df_token.shape[0] > 0 else 0
                )
                print(f"Successful generate count: {df_token_succeeded.shape[0]} ({percentage_succeeded}%)")
                print(f"Total token-based cost: ${token_cost:.6f}")

        # egress cost
        df_egress = df[(df["type"] == Type.GENERATE) & (df["message_size_bytes"] is not None)]
        egress_cost = 0
        if not df_egress.empty:
            egress_bytes = df_egress["message_size_bytes"].sum()
            egress_cost = (egress_bytes * self.egress_rate) / (1024**3)
            if print_details:
                self._h("Egress cost")
                print(f"Egress size: {humanize.naturalsize(egress_bytes) if self.use_human_format else egress_bytes}")
                print(f"Egress cost: ${egress_cost:.6f}")

        llm_cost = time_cost + token_cost + egress_cost
        total_cost = notebook_cost + token_cost + egress_cost
        if print_details:
            self._h()
            print(f"{Fore.CYAN}LLM cost: ${llm_cost:.6f}{Style.RESET_ALL}")
            print(f"{Fore.CYAN}Total cost: ${total_cost:.6f}{Style.RESET_ALL}")

        if self._error:
            self._e("Some costs could not be calculated. See above for details.")

        if export:
            df = pd.DataFrame(
                [
                    {
                        "datetime": pd.Timestamp.now(),
                        "instance cost": self.instance_hourly_cost,
                        "notebook duration": notebook_duration,
                        "notebook cost": notebook_cost,
                        "loading duration": load_duration,
                        "generate duration": generate_duration,
                        "time cost": time_cost,
                        "input cost": input_cost.sum(),
                        "output cost": output_cost.sum(),
                        "token cost": token_cost,
                        "egress cost": egress_cost,
                        "llm cost": llm_cost,
                        "total cost": total_cost,
                    }
                ]
            )
            if os.path.exists(export):
                df.to_csv(export, mode="a", header=False, index=False)
            else:
                df.to_csv(export, index=False)
        return llm_cost, total_cost

    CostTrackerStats = namedtuple(
        "CostTrackerStats", "requests tokens_per_minute total_input_tokens total_output_tokens"
    )

    def stats(
        self,
        print_details: bool = True,
    ) -> CostTrackerStats:
        """
        Return statistics about the LLM generations: requests and tokens per minute.
        This is useful to check if we're hitting the API limits.
        Args:
            print_details: whether to print the stat details.
        Returns:
            a tuple with two dataframes: the requests per minute and the tokens per minute.
        """
        df = self.dataframe()
        df_token = df[df["type"] == Type.GENERATE]
        df_token_success = df_token[df_token["status"] == Status.SUCCESS]
        df_token_fail = df_token[df_token["status"] == Status.FAIL].copy()

        if "error" not in df_token_fail.columns:
            df_token_fail["error"] = pd.NA
        df_token_fail["error"] = df_token_fail["error"].astype(str)
        df_token_fail_struct_out = df_token_fail[df_token_fail["error"].str.contains("StructuredOutput", na=False)]
        df_token_fail_rate_limit = df_token_fail[df_token_fail["error"].str.contains("RateLimitException", na=False)]
        df_token_fail_service = df_token_fail[df_token_fail["error"].str.contains("ServiceErrorException", na=False)]
        df_token_fail_other = df_token_fail[
            ~df_token_fail["error"].str.contains("StructuredOutput|RateLimitException|ServiceErrorException", na=False)
        ]

        requests_per_minute = df_token_success.groupby("minute_bucket").size().reset_index(name="requests_count")
        tokens_per_minute = (
            df_token_success.groupby("minute_bucket")["total_tokens"].sum().reset_index(name="total_tokens_per_minute")
        )
        if print_details:
            self._h("LLM stats")
            print(f"Generate count: {df_token.shape[0]}")
            pc_success = df_token_success.shape[0] / df_token.shape[0] * 100 if df_token.shape[0] > 0 else 0
            print(f"Successful generate count: {df_token_success.shape[0]} ({pc_success:.2f}%)")
            pc_fail = df_token_fail.shape[0] / df_token.shape[0] * 100 if df_token.shape[0] > 0 else 0
            print(f"Failed generate count: {df_token_fail.shape[0]} ({pc_fail:.2f}%)")

            pc_fail_struct_out = (
                df_token_fail_struct_out.shape[0] / df_token_fail.shape[0] * 100 if df_token_fail.shape[0] > 0 else 0
            )
            print(
                f"Failed generate count because of structured output: "
                f"{df_token_fail_struct_out.shape[0]} "
                f"({pc_fail_struct_out:.2f}%)"
            )
            pc_fail_rate_limit = (
                df_token_fail_rate_limit.shape[0] / df_token_fail.shape[0] * 100 if df_token_fail.shape[0] > 0 else 0
            )
            print(
                f"Failed generate count because of rate limit: "
                f"{df_token_fail_rate_limit.shape[0]} "
                f"({pc_fail_rate_limit:.2f}%)"
            )
            pc_fail_service = (
                df_token_fail_service.shape[0] / df_token_fail.shape[0] * 100 if df_token_fail.shape[0] > 0 else 0
            )
            print(
                f"Failed generate count because of service error: "
                f"{df_token_fail_service.shape[0]} "
                f"({pc_fail_service:.2f}%)"
            )
            pc_fail_other = (
                df_token_fail_other.shape[0] / df_token_fail.shape[0] * 100 if df_token_fail.shape[0] > 0 else 0
            )
            print(
                f"Failed generate count because of other errors: {df_token_fail_other.shape[0]} ({pc_fail_other:.2f}%)"
            )

            print(f"Generate duration: {self._st(df_token, 'duration')})")
            print(f"Requests per minute: {self._s(requests_per_minute, 'requests_count')}")
            print(f"Tokens per minute: {self._s(tokens_per_minute, 'total_tokens_per_minute')}")

        return self.CostTrackerStats(
            requests_per_minute["requests_count"].max(),
            tokens_per_minute["total_tokens_per_minute"].max(),
            df["input_tokens"].sum(),
            df["output_tokens"].sum(),
        )


class PricingDataLoader:
    @staticmethod
    def get_filepaths() -> list[str]:
        path = resources.files("lumiflow_ai_models").joinpath("data/pricing")
        return glob.glob(f"{path}/*.tsv")

    @staticmethod
    def convert_to_float_if_possible(value):
        try:
            return float(value.strip())
        except ValueError:
            return value

    @staticmethod
    def get_data_from_file(filepath: str) -> dict:
        """
        Read the pricing data from a file.
        Args:
            filepath: the path to the pricing file.
        Returns:
            the pricing data, in a dictionary. The keys are the model IDs, which are assumed
            to be the first column in the tsv file, prefixed with the provider name, which is assumed to be the file
            basename. Costs are assumed to be just numbers (no currency).
        """
        result = {}
        provider = os.path.splitext(os.path.basename(filepath))[0]
        with open(filepath, "r") as file:
            header = None
            for line in file:
                line = line.split("#")[0].strip()  # Remove comments
                if line:  # Skip empty lines
                    if not header:  # The first line is the header
                        header = line.strip().split("\t")
                    else:
                        row = [
                            PricingDataLoader.convert_to_float_if_possible(value) for value in line.strip().split("\t")
                        ]
                        key = provider + "/" + row[0]
                        result[key] = dict(zip(header, row))
        return result

    @staticmethod
    def get_data() -> dict:
        result = {}
        for filepath in PricingDataLoader.get_filepaths():
            result.update(PricingDataLoader.get_data_from_file(filepath))
        return result


DEFAULT_TRACKER = Tracker(instance_id=None)
