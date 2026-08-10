import os
import json
import litellm

def validate_api_keys():
    valid_api_keys = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"]
    if not any(os.environ.get(k) for k in valid_api_keys):
        raise ValueError("No API key is set")


def validate_env_vars(env_vars: list[str]):
    for env_var in env_vars:
        if not os.environ.get(env_var):
            raise ValueError(f"{env_var} is not set")


def _debug_mode_enabled():
    return os.environ.get("DEBUG_AI_WORKFLOWS", "").strip().lower() in ("true", "1", "yes")


def run_agent(
    messages: list,
    tools: list,
    handle_tool_call,
    model: str,
    terminal_tools: set | frozenset = frozenset(),
    max_turns: int = 10,
    max_output_tokens: int = 5000,
    token_budget: int = 1000000,
):
    """
    Runs the agent loop until the model stops, calls no tools, or calls a tool
    listed in `terminal_tools`. Terminal tools end the run immediately, to
    prevent further model calls (and wasted tokens).
    """
    debug = _debug_mode_enabled()
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_tokens = 0
    total_cost = 0.0
    truncated = False

    for turn in range(1, max_turns + 1):
        response = litellm.completion(
            model=model,
            messages=messages,
            tools=tools,
            max_tokens=max_output_tokens,
        )

        # Accounting always runs; only the printing is gated on debug.
        usage = getattr(response, "usage", None)
        prompt_tokens = (getattr(usage, "prompt_tokens", 0) if usage else 0) or 0
        completion_tokens = (getattr(usage, "completion_tokens", 0) if usage else 0) or 0
        tokens = (getattr(usage, "total_tokens", 0) if usage else 0) or 0
        total_prompt_tokens += prompt_tokens
        total_completion_tokens += completion_tokens
        total_tokens += tokens or (prompt_tokens + completion_tokens)

        try:
            total_cost += litellm.completion_cost(completion_response=response)
        except Exception:
            pass

        if debug:
            print(
                f"[debug] turn={turn} tokens prompt={prompt_tokens} "
                f"completion={completion_tokens} total={tokens} "
                f"running_total={total_tokens}"
            )

        choice = response.choices[0]
        message = choice.message

        if choice.finish_reason == "length":
            truncated = True
            print(
                f"[agent] WARNING: output hit max_tokens={max_output_tokens} on turn {turn}. "
                "Any tool call from this turn is likely malformed."
            )

        if message.content:
            print(f"[agent] {message.content}")
        messages.append(message.model_dump(exclude_none=True))

        if choice.finish_reason == "stop" or not message.tool_calls:
            break

        finished = False
        tool_results = []
        for tool_call in message.tool_calls:
            name = tool_call.function.name
            try:
                inputs = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError as e:
                print(f"[agent] Malformed arguments for {name}: {e}")
                tool_results.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": f"Error: arguments were not valid JSON ({e}). Please retry.",
                })
                continue

            result = handle_tool_call(name, inputs)
            tool_results.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })
            if name in terminal_tools:
                finished = True

        messages.extend(tool_results)

        if finished:
            print("[agent] Terminal tool called, ending run.")
            break

        if token_budget is not None and total_tokens >= token_budget:
            print(
                f"[agent] Token budget exhausted "
                f"({total_tokens} >= {token_budget}), stopping before next call."
            )
            break
    else:
        print(f"[agent] Hit max_turns={max_turns} without finishing.")

    if debug:
        print(
            f"[debug] summary prompt={total_prompt_tokens} "
            f"completion={total_completion_tokens} total={total_tokens} "
            f"estimated_cost=${total_cost:.6f}"
        )

    return {
        "prompt_tokens": total_prompt_tokens,
        "completion_tokens": total_completion_tokens,
        "total_tokens": total_tokens,
        "estimated_cost": total_cost,
        "truncated": truncated,
    }
