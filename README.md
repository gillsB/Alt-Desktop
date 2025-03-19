# Alt-Desktop

An extremely customizable Desktop Alternative. Re-write from the ground up in Electron as opposed to the [python build](https://github.com/gillsB/Alternative-Desktop-Python).

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

Testing program (e2e):
npm run test:e2e

Testing program (unit testing):
npm run test:unit

### Current environment and testing:

Reminder appdata-file:// protocol ONLY works in AppData/Roaming/AltDesktop. All other paths will be rejected.

1. Run the program to build the Appdata/Roaming/AltDesktop and subfolders.
2. Copy contents of desktopIcons_EXAMPLE.json into Appdata/Roaming/AltDesktop/desktopIcons.json
3. Add a image.png, image2.png, and image3.png into Appdata/Roaming/AltDesktop/icons folder.  
   or update the "image": to the full file path or "icons/image_name_here.png"
