# LLM (Local Library Manager)

I have a ton of libraries I made for my own use in various programming languages, so I thought I'd make a tool to help with that.

Note: It is meant to be used with a [nerd font](https://nerdfonts.com/).

It currently supports a GUI to use some commands more easily but also has command-line arguments:<br>
* `update <lib>`: updates the specified library, `all` and `*` are also accepted to update all libraries
* `install <lib> [name]`: installs the provided library, with an optionnal filename that can be ommited if the library specifies a default file name
* `add <filepath> <name>`: adds the provided file to the library list
* `list [path]`: list all libraries as well as the files using them, if a *path* is provided, it will instead list all the libraries used at this place, as well as all of its subfolders
* `status`: lists all the issues like files requiring an update, or files referenced that can't be found
* `audit`: fixes all the issues listed in *status*
* `configure <lib>`: opens the configuration menu for the given library
* `link <filepath> <lib>`: adds the file to the provided library's usage list, making it update whenever the *lib* library updates
* `unlink <filepath>`: removes the usage of *filepath*
* `uninstall <filepath>`: removes the usage of *filepath* and deletes the file