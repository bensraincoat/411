# Capstone

## Setup / Dev information
- Open a terminal in the project root and run "npm run dev" to start Vite
- Open a new terminal and run "npm run api" to start Flask
	- Should work on Windows, probably won't on Linux, fix this later
- Open a third terminal and run "curl http://localhost:5000/api/time" to test if Flask is up and running

##### Troubleshooting notes
- "Cannot be loaded because running scripts is disabled on this system"
	- Run "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser" in Powershell and try whatever you were doing again

- "Security Warning: Script Execution Risk  Invoke-WebRequest parses the content of the web page. Script code..."
	- You might hit this running your first curl request for the API
	- Allow this by entering either Y or A