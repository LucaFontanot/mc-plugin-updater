const { app, BrowserWindow, ipcMain,globalShortcut,screen,shell, ipcRenderer} = require('electron')
const path = require("path");
const fs = require("fs");
const JSZip = require("jszip");
const yaml = require("js-yaml");
const axios = require("axios");

function createWindow () {
    let s = null;
    const win = new BrowserWindow({
        width: 1000,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        title:"MC Plugin Manager",
        icon:path.join(__dirname,"build","icon.png")
    })
    win.setTitle("MC Plugin Manager")
    win.loadFile('src/index.html')

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
    win.setMenu(null)
    ipcMain.handle('list-files', async (event, dir) => {
        //if is not a directory remove the file at the end
        if (!fs.statSync(dir).isDirectory()){
            dir = path.dirname(dir);
        }
        return [dir,fs.readdirSync(dir)];
    })
    ipcMain.handle('get-jar-metadata', async (event, jar) => {
        try{
            //open the jar as a zip and load the plugin.yaml file
            const zip = new JSZip()
            const data = await zip.loadAsync(fs.readFileSync(jar))
            const file = data.files["plugin.yml"];
            if (file === undefined){
                return false;
            }
            const content = await file.async("text");
            //parse the yaml file
            const doc = yaml.load(content);
            //return the data
            return doc;

        }catch (e){
            return false;
        }
    })
    ipcMain.handle('get-jar-online-metadata', async (event, pluginfo) => {
        if (typeof pluginfo.name !== "string"){
            return null;
        }
        try{
            let response = await axios.get("https://api.spiget.org/v2/search/resources/"+pluginfo.name+"?field=name&size=10&sort=-downloads");
            let first = true;
            if (response.data.length>0) {
                for (let data of response.data) {
                    let id = data.id;
                    let version = await axios.get("https://api.spiget.org/v2/resources/" + id + "/versions/?size=100&sort=-releaseDate");
                    data.versions = version.data
                    let found = false;
                    for (let v of data.versions) {
                        //check if version pattern is similar, for example  1.2.3 is similar to 1.2.4 but 1.2.3 is not similaro to 1.2
                        let name1 = v.name.toString().split(".")
                        let name2 = pluginfo.version.toString().split(".")
                        if (name1.length === name2.length) {
                            if (name1.length>2){
                                name1.splice(name1.length-1,1)
                                name2.splice(name2.length-1,1)
                            }
                            if (name1.join(".") === name2.join(".")) {
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found === false && first===true) {
                        continue;
                    }
                    let names = await axios.get("https://api.spiget.org/v2/resources/" + id + "/updates?size=100&sort=-date");
                    for (let name of names.data) {
                        for (let v of data.versions) {
                            if (v.resource === name.resource) {
                                v.title = name.title;
                                v.description = name.description;
                            }
                        }
                    }
                    if (found=== false) {
                        first=data;
                        continue;
                    }
                    return data;
                }
            }
            if (first!==true){
                return first;
            }
            return null;
        }catch (e){
            return null;
        }
    })
    ipcMain.handle('update-plugin', async (event, pluginfo) => {
        try {
            let name = pluginfo.name + "-" + pluginfo.newVersion + ".jar"
            let dir = path.dirname(pluginfo.filePath);
            let file = path.join(dir, name);
            let oldFile = pluginfo.filePath;;
            let url = "https://api.spiget.org/v2/resources/"+pluginfo.id+"/download"
            //download to file with axios
            let response = await axios.get(url, {
                responseType: 'stream'
            })
            //save the file
            response.data.pipe(fs.createWriteStream(file))
            //wait for the file to be saved
            return new Promise((resolve, reject) => {
                response.data.on('end', () => {
                    //delete the old file
                    fs.unlinkSync(oldFile)
                    resolve(true);
                })
                response.data.on('error', () => {
                    resolve(false)
                })
            })
        }catch (e){
            return false;
        }
    })
    ipcMain.handle('version', async (event, dir) => {
        return app.getVersion()
    })
    win.on("closed",()=>{

    })
}

app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', (w) => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

