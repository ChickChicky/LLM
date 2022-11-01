const fs = require('fs');
const {input,choice,added, getch} = require('./input');
const path = require('path');
const crypto = require('crypto');

const configPath = path.join(__dirname,'config.json');

function defaultCfg(lib) {
    return {}
}

function getLibs() {
    if (!fs.existsSync(configPath)) fs.writeFileSync(configPath,'{}');
    return Object.keys(JSON.parse(fs.readFileSync(configPath,'utf-8')));
}

function getCfg(lib) {
    if (!fs.existsSync(configPath)) fs.writeFileSync(configPath,'{}');
    return JSON.parse(fs.readFileSync(configPath,'utf-8'))[lib];
}

function addUsage(lib,fp) {
    if (!fs.existsSync(configPath)) fs.writeFileSync(configPath,'{}');
    let cfg = JSON.parse(fs.readFileSync(configPath,'utf-8'));
    cfg[lib] = cfg[lib]??{}
    cfg[lib].usages = [...(Array.isArray(cfg[lib].usages)?cfg[lib].usages:[]),path.resolve(fp)];
    fs.writeFileSync(configPath,JSON.stringify(cfg));
}

function removeUsage(lib,fp) {
    if (!fs.existsSync(configPath)) fs.writeFileSync(configPath,'{}');
    let cfg = JSON.parse(fs.readFileSync(configPath,'utf-8'));
    cfg[lib] = cfg[lib]??{}
    cfg[lib].usages = (Array.isArray(cfg[lib].usages)?cfg[lib].usages:[]).filter(p=>path.resolve(p)!=path.resolve(fp));
    fs.writeFileSync(configPath,JSON.stringify(cfg));
}

function addLib(fp,name) {
    if (!fs.existsSync(configPath)) fs.writeFileSync(configPath,'{}');
    let cfg = JSON.parse(fs.readFileSync(configPath,'utf-8'));
    cfg[name] = {
        path: path.resolve(fp),
        usages: []
    }
    fs.writeFileSync(configPath,JSON.stringify(cfg));
}

function safeArray(obj) {
    return Array.isArray(obj) ? obj : [];
}

function getVersion(fp) {
    return crypto.createHash('sha256').update(fs.readFileSync(fp)).digest().subarray(0,8).toString('base64');
}

function isUsed(lib,ignore_invalid=true) {
    let cfg = getCfg(lib);
    if (Array.isArray(cfg.usages)&&cfg.usages.length) {
        if (ignore_invalid) 
            return true;
        for (let u of cfg.usages)
            if (!fs.existsSync(u)) 
                return false;
        return true;
    }
    return false;
}

function getIcon(fn) {
    let icons = {
        '.js': '\x1b[38;2;247;223;30m\ue74e',
        '.ts': '\x1b[38;2;1;122;203m\ue628',
        '.lua': '\x1b[38;2;50;50;255m\ue620',
        '.py': '\x1b[38;2;255;217;74m\uf820',
        '.c':  '\x1b[38;2;0;89;156m\ufb70', 
        '.h':  '\x1b[38;2;89;0;200m\ufb70',
        '.cxx':'\x1b[38;2;0;89;156m\ue61d', '.cpp':'\x1b[38;2;0;89;156m\ue61d', //uFB71
        '.hpp':'\x1b[38;2;89;0;200m\ue61d',
        '.cs': '\x1b[38;2;0;89;156m\uf81a',
        '.java': '\x1b[38;2;236;32;37m\ue256',
        '.bash': '\x1b[38;2;200;200;200m\uebca',
    '<file>':'\x1b[38;2;140;150;200m\ueae9'};
    return icons[Object.keys(icons).find(i=>fn.endsWith(i))??'<file>'];
}

function saveConfig(lib,config) {
    if (!fs.existsSync(configPath)) fs.writeFileSync(configPath,'{}');
    let cfg = JSON.parse(fs.readFileSync(configPath,'utf-8'));
    cfg[lib] = config;
    fs.writeFileSync(configPath,JSON.stringify(cfg));
}

const libs = getLibs();

const allLibs = Symbol('<all libraries>');
const libColor = `\x1b[38;2;34;201;121m`;

const removeIcon = `\uf839`; // uf00d
const updateIcon = `\uebd9`; // ufbae
const updatedIcon = `\uf00c`;
const errorIcon = `\uea87`;

const missinglibs = () => {
    if (!libs.length) {
        console.log('No library found, try adding one with the \x1b[32m\'Add\'\x1b[m command');
        return true;
    }
    return false;
}

async function menu_update(name) {

    if (missinglibs()) return;

    let lib;

    if (name) {
        if (libs.includes(name) || name == allLibs) {
            lib = name;
        } else {
            console.log(`\x1b[31m\uf00d\x1b[m No such library`);
            return;
        }
    } else {
        lib = await choice('\ueb29 Choose a library to update',{
            values: ['\x1b[33m*\x1b[m All',...libs.map(lib=>{
                let cfg = getCfg(lib);
                return `\x1b[33m${getIcon(cfg.path)}\x1b[m ${!isUsed(lib,false)?'\x1b[90m':''}${lib}\x1b[m`;
            })],
            rv: [allLibs,...libs],
            ln: false, clear: true
        });
    }

    if (lib == allLibs) {

        let updates = Object.fromEntries(libs.map(l=>[l,[]]));

        for (let lib of libs) {
            let cfg = getCfg(lib);
            let version = getVersion(cfg.path);
            for (let usage of safeArray(cfg.usages)) {
                if (fs.existsSync(usage)) {
                    let v = getVersion(usage);
                    if (v != version) updates[lib].push(usage);
                }
            }
        }

        updates = Object.fromEntries( Object.keys(updates).filter( lib => updates[lib].length ).map( lib => [lib,updates[lib]] ) );

        if (!Object.keys(updates).length) {
            console.log('Everything\'s up to date.');
            return;
        }

        let l = 0;

        console.log(`\uebdf Updatable:`);
        for ( let lib of Object.keys(updates) ) {
            let cfg = getCfg(lib);
            console.log(` \x1b[33m${getIcon(cfg.path)} ${libColor}${lib}\x1b[m`); l++;
            for (let usage of updates[lib]) {
                console.log(`   \x1b[33m${updateIcon}\x1b[m ${usage}`); l++;
            }
        }

        let p = await input(`Proceed updating (Y/n) ? `,{emptyPlaceholder:'\x1b[90myes\x1b[m'})||'y';

        if (['yes','y'].includes(p.toLowerCase())) {
            process.stdout.write(`\x1b[2K\x1b[A`.repeat(l+1)+'\x1b[2K\x1b[G');
            let error = 0;
            let updated = 0;
            for ( let lib of Object.keys(updates) ) {
                let cfg = getCfg(lib);
                let content = fs.readFileSync(cfg.path);
                console.log(` \x1b[33m${getIcon(cfg.path)} ${libColor}${lib}\x1b[m`);
                for (let usage of updates[lib]) {
                    process.stdout.write(`   \x1b[33m\uf068\x1b[m ${usage}`);
                    try {
                        fs.copyFileSync(cfg.path,usage);
                        console.log(`\x1b[G   \x1b[32m\uf00c\x1b[m ${usage}`);
                        updated++;
                    } catch (e) {
                        console.log(`\x1b[G   \x1b[31m\uf00d\x1b[m ${usage} (${e})`);
                        error++;
                    }
                }
            }
            console.log(`\nDone !${updated?`\n \x1b[32m${updated}\x1b[m updated file${updated>1?'s':''}`:''}${error?`\n \x1b[31m${error}\x1b[0m failed update${error>1?'s':''}`:''}`);
        }

    } else {

        let cfg = getCfg(lib);
        let usages = cfg.usages;
        if (!usages.length) {
            console.log(`\x1b[90mNo usages found for ${libColor}${lib}\x1b[m`)
            return;
        }
        let version = getVersion(cfg.path);
        console.log(`\uebdf Usages of ${getIcon(cfg.path)} ${libColor}${lib}\x1b[m:`);
        let noupdate = [];
        let u = 0;
        for (let usage of usages) {
            let badge = '\x1b[34m\uf128';
            if (fs.existsSync(usage)) {
                u++;
                let v = getVersion(usage);
                if (v == version) {
                    badge = `\x1b[32m\uf00c`;
                    noupdate.push(usage);
                    u--;
                } else 
                    badge = `\x1b[33m${updateIcon}`;
            }
            //console.log(`  ${badge} \x1b[33m${fs.existsSync(usage)?getIcon(usage):'\x1b[91m\uf757'}\x1b[m ${fs.existsSync(usage)?'\x1b[36m':'\x1b[90m'}${usage}\x1b[m`);
            console.log(`  ${fs.existsSync(usage)?badge:`\x1b[91m\uf757`} \x1b[m ${fs.existsSync(usage)?'\x1b[36m':'\x1b[90m'}${usage}\x1b[m`);
        }
        if (!u) {
            console.log('Already up to date.');
            return;
        }
        let r = await input('Update all usages (Y/n) ? ')||'y';
        if (['y','yes'].includes(r.toLowerCase())) {
            process.stdout.write(`\x1b[2K\x1b[A`.repeat(usages.length+2));
            console.log('\uebdf Updating...');
            let content = fs.readFileSync(cfg.path);
            let updated = 0,
                error   = 0,
                skip    = 0;
            for (let usage of usages) {
                if (fs.existsSync(usage)) {
                    process.stdout.write(` \x1b[33m\uf068\x1b[m ${usage}`);
                    if (noupdate.includes(usage)) {
                        console.log(`\x1b[G \x1b[90m\uf444 ${usage} (already up to date)\x1b[m`);
                        continue;
                    }
                    try {
                        fs.writeFileSync(usage,content);
                        console.log(`\x1b[G \x1b[32m\uf00c\x1b[m ${usage}`);
                        updated++;
                    } catch (e) {
                        console.log(`\x1b[G \x1b[31m\uf00d\x1b[m ${usage} (${e})`);
                        error++;
                    }
                } else {
                    console.log(` \x1b[90m\uf444 Skipping ${usage}\x1b[m`);
                    skip++;
                }
            }
            console.log(`\nDone !${updated?`\n \x1b[32m${updated}\x1b[m updated file${updated>1?'s':''}`:''}${error?`\n \x1b[31m${error}\x1b[0m failed update${error>1?'s':''}`:''}${skip?`\n \x1b[90m${skip}\x1b[m skipped file${skip>1?'s':''}`:''}`);
        }
    }
}

async function menu_add_lib(pathname,libname) {
    let fname = path.resolve((pathname?console.log():null,pathname)??await input('\uea7f File path: \x1b[36m')); console.log(`\x1b[A\x1b[G\x1b[m\uea7f Adding \x1b[36m${fname}\x1b[m`);
    if (!fs.existsSync(fname)) {
        console.log(`\x1b[31m\uf00d\x1b[m No such file or directory`);
        return;
    }

    let name = (libname?console.log():null,libname)??await input(`Library name: ${libColor}`,{default:path.basename(fname)});
    if (libs.includes(name)) {
        console.log(`\x1b[31m\uf00d\x1b[m Name already taken`);
        return;
    }
    console.log(`\x1b[A\x1b[G\x1b[mLibrary name: ${libColor}${name}\x1b[m`);

    addLib(fname,name);

    console.log('Done !');
}

async function menu_install(libname,filepath) {
    if (missinglibs()) return;

    let lib;
    
    if (libname) {
        if (libs.includes(libname)) {
            lib = libname;
        } else {
            console.log(`\x1b[31m\uf00d\x1b[m No such library`);
            return;
        }
    } else {
        lib = await choice('Select a library to use',{
            values: libs.map(lib=>{
                let cfg = getCfg(lib);
                return `\x1b[33m${getIcon(cfg.path)}\x1b[m ${lib}\x1b[m`;
            }),
            rv: libs,
            ln: false, clear: true
        });
    }

    console.log(`Using ${libColor}${lib}\x1b[m`);

    let cfg = getCfg(lib);

    let fname = path.resolve((filepath?console.log():null,filepath) ?? await input('File path: ',{
        emptyPlaceholder: `\x1b[90m${cfg.defaultFileName ?? path.basename(cfg.path)}\x1b[m`
    })); console.log(`\x1b[A\x1b[2K\x1b[A\x1b[GUsing ${libColor}${lib} \x1b[mfor \x1b[36m${fname}\x1b[m`);

    if (fs.existsSync(fname)) {
        let used = libs[libs.map(l=>getCfg(l)).findIndex(l=>(l.usages??[]).some(u=>path.resolve(u)==fname))];
        if (used) {
            console.log(`\x1b[31m\uf00d\x1b[m Already using ${libColor}${used}\x1b[m`);
            return;
        }
        let o = await input('Overwrtie file (y/N) ? ',{emptyPlaceholder:'\x1b[90mno\x1b[m'});
        if (!['y','yes'].includes(o.toLowerCase())) return;
    }

    console.log(`Installing...`);
    fs.copyFileSync(cfg.path,fname);
    addUsage(lib,fname);
    console.log(`Done !`);
}

async function menu_remove_lib(filepath,remove) {
    if (missinglibs()) return;

    let fname = path.resolve((filepath?console.log():null,filepath) ?? await input('File path: \x1b[36m')); console.log(`\x1b[A\x1b[G\uf839 Unlinking \x1b[36m${fname}\x1b[m`);
    if (!fs.existsSync(fname)) {
        console.log(`\x1b[31m\uf00d\x1b[m No such file or directory `);
        return;
    }
    
    let used = libs[libs.map(l=>getCfg(l)).findIndex(l=>(l.usages??[]).some(u=>path.resolve(u)==fname))];
    if (!used) {
        console.log(`\x1b[31m\uf00d\x1b[m No libary linked to \x1b[36m${fname}\x1b[m`);
        return;
    }

    console.log(`\x1b[A\x1b[2K\x1b[GUnlinking ${libColor}${used}\x1b[m from \x1b[36m${fname}\x1b[m`);

    let rm = (remove==undefined||remove.toString()=='true')?await input('Remove file (Y/n) ? ',{emptyPlaceholder:'\x1b[90myes\x1b[m'})||'y':'n';

    removeUsage(used,fname);

    if (['yes','y'].includes(rm.toLowerCase())) fs.rmSync(fname);

    console.log(`\x1b[A\x1b[2K\x1b[GUnlinked ${libColor}${used}\x1b[m from \x1b[36m${fname}\x1b[m${rm?` and removed file`:''}`);
}

async function menu_link(libname,filepath) {
    if (missinglibs()) return;

    let lib;

    if (filepath) {
        let used = libs[libs.map(l=>getCfg(l)).findIndex(l=>(l.usages??[]).some(u=>path.resolve(u)==path.resolve(filepath)))];
        if (used) {
            console.log(`\x1b[31m\uf00d\x1b[m Already using ${libColor}${used}\x1b[m`);
            return;
        }
    }
    
    if (libname) {
        if (libs.includes(libname)) {
            lib = libname;
        } else {
            console.log(`\x1b[31m\uf00d\x1b[m No such library`);
            return;
        }
    } else {
        lib = await choice('\uf836 Select a library to link to',{
            values: libs.map(lib=>{
                let cfg = getCfg(lib);
                return `\x1b[33m${getIcon(cfg.path)}\x1b[m ${libColor}${lib}\x1b[m`;
            }),
            rv: libs,
            ln: false, clear: true
        });
    }

    console.log(`\uf836 Linkning to ${libColor}${lib}\x1b[m`);

    let fname = path.resolve((filepath?console.log():null,filepath)??await input('File path: \x1b[36m'));
    if (!fs.existsSync(fname)) {
        console.log(`\x1b[31m\uf00d\x1b[m No such file or directory `);
        return;
    }
    console.log(`\x1b[A\x1b[2K\x1b[A\x1b[G\uf836 Linking \x1b[36m${fname} \x1b[mto ${libColor}${lib}\x1b[m`);

    let used = libs[libs.map(l=>getCfg(l)).findIndex(l=>(l.usages??[]).some(u=>path.resolve(u)==fname))];
    if (used) {
        console.log(`\x1b[31m\uf00d\x1b[m Already using ${libColor}${used}\x1b[m`);
        return;
    }

    addUsage(lib,fname);

    console.log(`\x1b[A\x1b[G\uf836 Linked \x1b[36m${fname} \x1b[mto ${libColor}${lib}\x1b[m.`);
}

async function menu_configure(libname) {
    if (missinglibs()) return;

    let lib;

    if (libname) {
        if (libs.includes(libname)) {
            lib = libname;
        } else {
            console.log(`\x1b[31m\uf00d\x1b[m No such library`);
            return;
        }
    } else {
        lib = await choice('\ue615 Select a library to configure',{
            values: libs.map(lib=>{
                let cfg = getCfg(lib);
                return `\x1b[33m${getIcon(cfg.path)}\x1b[m ${lib}\x1b[m`;
            }),
            rv: libs,
            ln: false, clear: true
        });
    }

    let cfg = getCfg(lib);

    while (true) {

        let p = await choice(`\ue615 Configuration of ${libColor}${lib}\x1b[m`,{
            values: [
                `Default file name: ${cfg.defaultFileName?`\x1b[36m${cfg.defaultFileName}`:`\x1b[90m${path.basename(cfg.path)}`}\x1b[m`
            ],
            rv: [
                'defaultFileName',
            ],
            ln: false, clear: true
        });

        if (p == 'defaultFileName') {
            let v = await input('Default file name: ',{
                default: cfg.defaultFileName??'',
                emptyPlaceholder: `\x1b[90m`+path.basename(cfg.path)+`\x1b[m`
            });
            process.stdout.write(`\x1b[A\x1b[2K\x1b[G`);
        }

    }
}

async function menu_list(folder) {
    if (missinglibs()) return;

    if (folder) {

        folder = path.resolve(folder);

        console.log(`\ufb44 Listing libaries in \x1b[36m${folder}\x1b[m`);

        let paths = {};
        for (let lib of libs) {
            let cfg = getCfg(lib);
            let version = getVersion(cfg.path);
            Object.assign(paths,
                Object.fromEntries(
                    cfg.usages.filter(
                        usage => path.parse(usage).dir.startsWith(folder)
                    ).map(
                        usage => [path.relative(folder,usage),[lib,fs.existsSync(usage)?getIcon(cfg.path):getIcon(''),fs.existsSync(usage)?getVersion(usage)!=version:false,fs.existsSync(usage)]]
                    )
                )
            );
        }

        if (!Object.keys(paths).length) {
            console.log(` \x1b[90mNo library found\x1b[m`);
        }

        let ml = Math.max(...Object.keys(paths).map(p=>p.length));
        let nl = Math.min(...Object.values(paths).map(p=>p[0]));

        for (let p of Object.keys(paths)) {
            let [libname,icon,upd,e] = paths[p];
            console.log(` \x1b[33m${e?icon:'\x1b[91m\uf757'} ${e?'\x1b[36m':'\x1b[90m'}${p}\x1b[m ${' '.repeat(ml-p.length)}${e?libColor:'\x1b[90m'}${libname}${upd?' '+(' '.repeat(nl-libname.length))+'\x1b[33m(Requires update)\x1b[m':''}\x1b[m`);
        }

    } else {

        console.log(`\ufb44 Listing all libaries`);

        for (let lib of libs) {
            let cfg = getCfg(lib);
            console.log(`  \x1b[33m${getIcon(cfg.path)} ${libColor}${lib} \x1b[36m${cfg.path}\x1b[m`);
            if (!cfg.usages||!cfg.usages.length) {
                console.log(`    \x1b[90mNo usages found\x1b[m`);
                continue;
            }
            let version = getVersion(cfg.path);
            for (let usage of cfg.usages) {
                let badge = '\x1b[34m';
                let utd = true;
                if (fs.existsSync(usage)) {
                    let v = getVersion(usage);
                    if (v == version)
                        badge = `\x1b[32m`;
                    else {
                        badge = `\x1b[33m`;
                        utd = false;
                    }
                }
                console.log(`    ${!fs.existsSync(usage)?'\x1b[91m':`${badge}`}\uf942 ${!fs.existsSync(usage)?'\x1b[m\uf757 ':''}${!fs.existsSync(usage)?'\x1b[90m':'\x1b[m'}${usage} ${!utd?`\x1b[33m(Requires update)`:``}\x1b[m`);
            }
        }

    }
}

async function openMenu(value) {
    value = value.toLowerCase();

    if (value == 'update') {
        await menu_update();
    }


    if (value == 'add') {
        await menu_add_lib();
    }


    if (value == 'manage') {

        let action = await choice('Management Options',{
            values: [
                '\x1b[33m\uf838 Use Library\x1b[m',
                '\x1b[31m\uf839 Remove Library\x1b[m',
                '\x1b[36m\uf836 Link\x1b[m'
            ], 
            rv : [
                'Use Lib',
                'Rem Lib',
                'Lnk Lib'
            ],
            ln: false,
            clear: true
        });

        if (action == 'Use Lib') {
            await menu_install();
        }

        if (action == 'Rem Lib') {
            await menu_remove_lib();
        }

        if (action == 'Lnk Lib') {
            await menu_link();
        }

    }


    if (value == 'configure') {
        await menu_configure();
    }


    if (value == 'list') {
        await menu_list();
    }
}

const argv = process.argv.slice(2).filter(a=>!a.startsWith('-'));

if (argv.length) {

    let action = ({
        'i': 'install', 'use': 'install',
        'l': 'link',
        'a': 'add',
        'c': 'configure', 'config': 'configure',
        'u': 'update',
        'r': 'uninstall', 'remove': 'uninstall',
        'd': 'unlink',
        's': 'status',
        'f': 'audit', 'fix': 'audit'
    }[argv[0]]??argv[0]).toLowerCase();


    if (action == 'update') {
        menu_update(['all','*'].includes(argv[1].toLowerCase())?allLibs:argv[1]);
    } else if (action == 'install') {
        menu_install(argv[1],argv[2]);
    } else if (action == 'link') {
        menu_link(argv[2],argv[1]);
    } else if (action == 'add') {
        menu_add_lib(argv[1],argv[2]);
    } else if (action == 'configure') {
        menu_configure(argv[1]);
    } else if (action == 'uninstall') {
        menu_remove_lib(argv[1]);
    } else if (action == 'list') {
        menu_list(argv[1]);
    } else if (action == 'unlink') {
        menu_remove_lib(argv[1],false);
    } else if (action == 'status') {
        if (missinglibs()) return;
        let non_existing_links = 0;
        let needs_update = 0;
        for (let lib of libs) {
            let cfg = getCfg(lib);
            let version = getVersion(cfg.path);
            for (let usage of cfg.usages) {
                if (!fs.existsSync(usage)) non_existing_links++;
                else if (getVersion(usage)!=version) needs_update++;
            }
        }
        if (non_existing_links) {
            console.log(`  \x1b[31m${non_existing_links}\x1b[m link${non_existing_links>1?'s':''} to non-existing file${non_existing_links>1?'s':''}.`);
        }
        if (needs_update) {
            console.log(`  \x1b[33m${needs_update}\x1b[m file${needs_update>1?'s':''} requiring an update.`);
        }
        if (!non_existing_links&&!needs_update) {
            console.log(`\x1b[32m\uf00c\x1b[m No issue detected.`);
        } else {
            console.log(`Run \x1b[36mllm audit\x1b[m to fix ${needs_update+non_existing_links>1?'these':'this'} issue${needs_update+non_existing_links>1?'s':''}`);
        }
    } else if (action == 'audit') {
        let audits = Object.fromEntries( libs.map( lib => [lib,{to_remove:[],to_update:[]}] ) );

        for (let lib of libs) {
            let cfg = getCfg(lib);
            let version = getVersion(cfg.path);
            for (let usage of cfg.usages) {
                if (!fs.existsSync(usage)) {
                    audits[lib].to_remove.push(usage);
                } else if (version!=getVersion(usage)) {
                    audits[lib].to_update.push(usage);
                }
            }
        }

        audits = Object.fromEntries( Object.keys(audits).filter( lib => audits[lib].to_remove.length+audits[lib].to_update.length ).map( lib => [lib,audits[lib]] ) );

        if (!Object.keys(audits).length) {
            console.log('\uf044 No available audits.');
            return;
        }

        console.log('\uf044 Available audits:');

        let l = 0;

        for (let lib of Object.keys(audits)) {
            let cfg = getCfg(lib);
            let {to_remove,to_update} = audits[lib];
            l += 1 + to_remove.length + to_update.length;
            console.log(`  \x1b[33m${getIcon(cfg.path)} ${libColor}${lib} \x1b[m`);
            for (let p of to_remove) console.log(`   \x1b[31m${removeIcon} \x1b[36m${p}\x1b[m`);
            for (let p of to_update) console.log(`   \x1b[33m${updateIcon} \x1b[36m${p}\x1b[m`);
        }

        input('Continue (Y/n) ? ',{emptyPlaceholder:'\x1b[90myes\x1b[m'}).then(
            ans => {
                if (['y','yes'].includes((ans||'y').toLowerCase())) {
                    process.stdout.write(`\x1b[A\x1b[2K\x1b[${l}A\x1b[G`);
                    let errors = 0;
                    for (let lib of Object.keys(audits)) {
                        let cfg = getCfg(lib);
                        let {to_remove,to_update} = audits[lib];
                        process.stdout.write(`\x1b[B\x1b[G`);
                        for (let p of to_remove) {
                            console.log(`   \x1b[91;3m${removeIcon} \x1b[23;36m${p}\x1b[m`);
                            delete cfg.usages[cfg.usages.indexOf(p)];
                        }
                        if (to_remove.length) saveConfig(lib,{...cfg,usages:cfg.usages.filter(u=>u)});
                        for (let p of to_update) {
                            try {
                                fs.copyFileSync(cfg.path,p);
                                console.log(`\x1b[G   \x1b[32m${updatedIcon} \x1b[36m${p}\x1b[m`);
                            } catch (e) {
                                console.log(`\x1b[G   \x1b[31m${errorIcon} \x1b[m${p} (${e})`);
                                errors++;
                            }
                        }
                    }
                    console.log(`\nSuccessfully applied audits.`);
                }
            }
        )

    }

} else {

    let nl = libs.length==0;

    choice('Local Library Manager',{
        values: [
            ...(nl?[`\x1b[32;1m\uea7f Add\x1b[m`]:[]),
            `${nl?'\x1b[2m':''}\x1b[33m\ueb29 Update\x1b[m`,
            `${nl?'\x1b[2m':''}\ueaec Manage`,
            `${nl?'\x1b[2m':''}\x1b[36m\ue615 Configure\x1b[m`,
            ...(!nl?[`\x1b[32m\uea7f Add\x1b[m`]:[]),
            `${nl?'\x1b[2m':''}\ufb44 List\x1b[m`
        ], 
        rv : [
            ...(nl?[`Add`]:[]),
            'Update',
            'Manage',
            'Configure',
            ...(!nl?[`Add`]:[]),
            'List',
        ],
        ln: false,
        clear: true
    }).then(openMenu);

}