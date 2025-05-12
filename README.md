# Alt-Desktop

An extremely customizable Windows Desktop Alternative. Re-write from the ground up in Electron as opposed to the [python build](https://github.com/gillsB/Alternative-Desktop-Python).

## REQ:

basic node setup + react  
to install:  
npm install

### Testing requirements:

The chromium browser for playwright testing is not auto installed so if you wish to test run:  
npx playwright install chromium

Running:  
run with: npm run dev  
This will automatically run with the hot module reloading from vite. Basically it transpiles, then runs npm run dev:react (the server which hot reloads the frontend), then runs npm run dev:electron (launches the app). Changes to the frontend get displayed immediately upon saving sourcecode. Changes to electron must be reloaded (just run npm run dev which will transpile and run it).

building exe/distributable:  
npm run dist:win  
npm run dist:linux  
npm run dis:mac

The bare minimum python executable is already included, but if you want to edit it: (Requires python installed with requirements.txt).  
npm run py

### Current environment and testing:

1. Run the program to build the Appdata/Roaming/AltDesktop and subfolders.
2. Create icons via right clicks on desktop.
