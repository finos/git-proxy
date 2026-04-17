def validate_api_keys():
    valid_api_keys = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"]
    if not any(os.environ.get(k) for k in valid_api_keys):
        raise ValueError("No API key is set")


def validate_env_vars(env_vars: list[str]):
    for env_var in env_vars:
        if not os.environ.get(env_var):
            raise ValueError(f"{env_var} is not set")


def run_agent(messages: list, tools: list, handle_tool_call, model: str):
    while True:
        response = litellm.completion(
            model=model, messages=messages, tools=tools, temperature=0
        )
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
