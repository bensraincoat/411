# Capstone

## First setup
- Make sure you have Node and Python installed locally
	- If you're not sure, download and run this https://nodejs.org/dist/v26.8.1/node-v26.8.1-x64.msi
	- Make sure you allow it to download python etc during the install
	- It should pop up with a blue powershell window that downloads everything, prompts about 7gb disk space, and runs for a while

- After node install finishes, open a terminal and run:
	- `node -v`
		- Should return v26.8.1
	- `python --version`
		- Should return 3.14.7
	
## Running the project
- Open a terminal in the project root and run `npm run dev` to start Vite
- Open a new terminal and run `npm run api` to start Flask
	- Should work on Windows, probably won't on Linux or MacOS, I'll fix this later
- Open a third terminal and run `curl http://localhost:5000/api/time` to test if Flask is up and running

### Troubleshooting notes
- "Cannot be loaded because running scripts is disabled on this system"
	- Run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` in Powershell and try whatever you were doing again
- "Security Warning: Script Execution Risk  Invoke-WebRequest parses the content of the web page. Script code..."
	- You might hit this running your first curl request for the API
	- Allow this by entering either Y or A