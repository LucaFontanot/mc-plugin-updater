const {ipcRenderer} = require('electron');
const path = require("path")
const shell = require('electron').shell;

// assuming $ is jQuery
$(document).on('click', 'a[href^="http"]', function (event) {
    event.preventDefault();
    shell.openExternal(this.href);
});

var app = new Vue({
    el: '#app',
    data: {
        directory: '',
        pluginDirectory: '',
        plugins: [],
        loading: false,
        modal: false,
        modal_plugin: null,
        test: ""
    },
    methods: {
        updatePlugin: async function (plugin) {
            if (plugin.premium) {
                return shell.openExternal(plugin.url);
            }
            if (plugin.raw === null) {
                return alert("This plugin is not on spigotmc.org");
            }
            this.loading = true;
            let status = await ipcRenderer.invoke('update-plugin', plugin);
            this.loading = false;
            if (status === true) {
                plugin.hasUpdated = true;
            } else {
                alert("Error updating plugin");
            }
        },
        changeLogs: function (plugin) {
            let modal = new bootstrap.Modal(document.getElementById('changeLogs'), {
                keyboard: false
            });
            try {
                console.log(plugin.raw)
                let versions = plugin.raw.versions;
                let html = "";
                for (let version of versions) {
                    html += "<h5>" + version.name + "</h5>";
                    try {
                        let desc = atob(version.description);
                        //remove all html tags except <br>
                        desc = desc.replace(/<[^>]*>?/gm, function (tag) {
                            if (tag === "<br>") {
                                return tag;
                            }
                            return '';
                        });
                        html += "<p>" + desc + "</p>";
                    }catch (e){
                        console.log(e,"Error decoding base64",version.description)
                    }

                    html += "<hr>";
                }
                $("#changeLogsBody").html(html);
                modal.show();
            } catch (e) {
                console.log(e)
                modal.hide()
            }

        },
        loadPlugins: async function () {
            this.plugins = [];
            let p = document.getElementById("formFile").files[0].path;
            let files = await ipcRenderer.invoke('list-files', p)
            p = files[0]
            files = files[1];
            if (files.includes("plugins")) {
                p = path.join(p, "plugins");
            }
            files = await ipcRenderer.invoke('list-files', p)
            p = files[0];
            files = files[1];
            for (let file of files) {
                if (file.endsWith(".jar")) {
                    let plugInfo = await ipcRenderer.invoke('get-jar-metadata', path.join(p, file));
                    let plugMetaData = {
                        name: plugInfo.name,
                        version: plugInfo.version,
                        main: plugInfo.main,
                        author: plugInfo.author,
                        description: plugInfo.description,
                        remoteDescription: "",
                        file: file,
                        filePath: path.join(p, file),
                        newVersion: null,
                        imageBase64: "./images/loading-gif-png-5.gif",
                        id: null,
                        premium: false,
                        raw: null,
                        url: null,
                        downloads: 0,
                        hasUpdated: false
                    }
                    this.plugins.push(plugMetaData);
                    ipcRenderer.invoke('get-jar-online-metadata', plugMetaData).then(async (data) => {
                        if (data == null) {
                            //check if name has how many capital letters
                            let name = plugMetaData.name;
                            let count = 0;
                            for (let i = 0; i < name.length; i++) {
                                if (name[i] === name[i].toUpperCase()) {
                                    count++;
                                }
                            }
                            //count the spaces in the name
                            let spaces = name.split(" ").length;
                            if (count > 0 && spaces === 1) {
                                //Add a space before each capital letter, but not if it is the first letter
                                let newName = "";
                                for (let i = 0; i < name.length; i++) {
                                    if (i > 0 && name[i] === name[i].toUpperCase()) {
                                        newName += " ";
                                    }
                                    newName += name[i];
                                }
                                plugMetaData.name = newName;
                                data = await ipcRenderer.invoke('get-jar-online-metadata', plugMetaData);
                            }
                        }
                        if (data === null) {
                            plugMetaData.imageBase64 = "./images/x.jpg";
                        }
                        ;
                        try {
                            plugMetaData.downloads = data.downloads;
                        } catch (e) {
                        }
                        try {
                            plugMetaData.imageBase64 = "data:image/png;base64," + data.icon.data;
                        } catch (e) {
                        }
                        try {
                            plugMetaData.premium = data.premium;
                        } catch (e) {
                        }
                        try {
                            plugMetaData.id = data.id;
                        } catch (e) {
                        }
                        try {
                            plugMetaData.url = "https://www.spigotmc.org/resources/" + data.id + "/";
                        } catch (e) {
                        }
                        try {
                            plugMetaData.raw = data;
                        } catch (e) {
                        }
                        try {
                            plugMetaData.remoteDescription = data.tag;
                        } catch (e) {
                        }
                        try {
                            plugMetaData.newVersion = data.versions ? data.versions[0].name : "?";
                        } catch (e) {

                        }
                    })
                }
            }
        }
    }
});

