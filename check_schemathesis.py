import schemathesis
print(f"Schemathesis version: {schemathesis.__version__}")
print("Available functions:")
print([attr for attr in dir(schemathesis) if not attr.startswith('_')])