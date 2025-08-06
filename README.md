# Notice:

Currently re-writing the way that images are saved for desktop icons. Any existing icons will be broken, and any new icons will be broken.
As of August 5th, 2025. This will be removed when it has been re-written and icon images are marked safe again. Any old icon images will require re-adjusting manually. As this is very low traffic, I am not writing the functions to migrate old icons as it is unlikely for users
to be using this.

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

### Current Backgrounds.json testing:

1. Open the background select via right click desktop -> change background (top right in the header is an icon which looks like a desktop)
2. Drag and drop a video or image file to open Edit Background.
3. Fill out the fields you want then save. (Background file path should preview in main window).
4. This creates a background you can then select via the background select menu.

Consider these backgrounds slightly volatile. They may break/require editing later on as this whole backgrounds setup is still early in development with a lot of changes needing to be made.
