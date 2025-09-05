# Alt-Desktop

An extremely customizable Windows Desktop Alternative. Re-write from the ground up in Electron as opposed to the [python build](https://github.com/gillsB/Alternative-Desktop-Python).

Adding icons:
Right click anywhere -> New Icon to add an icon.  
Drop any file/program into the window to set the program file.  
Drop any image (gif included) into the window to set the image file.  
Or generate an icon from the program via: Generate Icon. This will fetch all possible icons (even works for pesky programs that use strictly external .ico files).  
![Adding an icon gif](/readme/Adding%20an%20icon.gif)

Adding a background:  
Right click anywhere -> Change Background to change/Add a background.  
Click Create Background OR just simply drop your background video/image onto the window to open up Edit Background.  
Give it a name, set the background path, the preview thumbnail (Any image or Gif). It will auto select tags for Type, Resolution, and Aspect ratio.  
![Adding a background gif](/readme/Adding%20a%20background.gif)

Want custom tags for easy searching? Just add a tag/category:  
In Edit Background, you can add a tag at the top or even add a Category.  
These will be your local tags and appear below the global tags. You can drag them to different categories or rename/delete them via right click.  
In the "Cateogories" menu from the button, you can re-arrange them by dragging, or rename them by double clicking.  
![Adding tags gif](/readme/Adding%20tags.gif)

## REQUIREMENTS:

basic node setup
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

The bare minimum rust/python executables are already included, but if you want to edit it:
npm run py (Requires Python installed with requirements.txt)  
npm run rust (Requires Rust installed)  

### Current environment and testing:

1. Run the program to build the Appdata/Roaming/AltDesktop and subfolders.
2. Create icons via right clicks on desktop.
