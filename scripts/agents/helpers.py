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


def run_agent(messages: list, tools: list, handle_tool_call, model: str):
    debug = _debug_mode_enabled()
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_tokens = 0
    total_cost = 0.0

    while True:
        response = litellm.completion(
            model=model, messages=messages, tools=tools, temperature=0
        )
        if debug:
            usage = getattr(response, "usage", None)
            prompt_tokens = getattr(usage, "prompt_tokens", None) if usage else None
            completion_tokens = getattr(usage, "completion_tokens", None) if usage else None
            tokens = getattr(usage, "total_tokens", None) if usage else None
            if prompt_tokens is not None:
                total_prompt_tokens += prompt_tokens
            if completion_tokens is not None:
                total_completion_tokens += completion_tokens
            if tokens is not None:
                total_tokens += tokens
            print(
                f"[debug] tokens prompt={prompt_tokens} "
                f"completion={completion_tokens} total={tokens}"
            )
            try:
                cost = litellm.completion_cost(completion_response=response)
                total_cost += cost
                print(f"[debug] estimated cost=${cost:.6f}")
            except Exception:
                print("[debug] estimated cost=unavailable")
        message = response.choices[0].message
        if message.content:
            print(f"[agent] {message.content}")
        messages.append(message.model_dump(exclude_none=True))
        if response.choices[0].finish_reason == "stop" or not message.tool_calls:
            break
        tool_results = []
        for tool_call in message.tool_calls:
            inputs = json.loads(tool_call.function.arguments)
            result = handle_tool_call(tool_call.function.name, inputs)
            tool_results.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })
        messages.extend(tool_results)

    if debug:
        print(
            f"[debug] summary prompt={total_prompt_tokens} "
            f"completion={total_completion_tokens} total={total_tokens} "
            f"estimated_cost=${total_cost:.6f}"
        )
