// ==UserScript==
// @name         BetterRedditShortcuts
// @namespace    http://tampermonkey.net/
// @version      0.125
// @description  Better shortcuts for reddit
// @author       printial
// @match        https://*.reddit.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

const bookmarks = 'bookmarks';
let menus = [];
let defaultSettings = {
    'show-subreddit-names-in-menu': {'type':'checkbox','value':false}
};
let settings = {};

const css =
`   #bookmarker-bar {display:block;height:20px;font-size:15px;width:100%;border:1px solid #000; position: fixed; top: 20px;z-index: 1000; background: #FFF; padding-left: 5px}
    .bookmarker-hover-panel {position:fixed;border:1px solid #000;padding: 5px;font-size: 15px;background:#FFF;z-index:1000;min-width: 110px}
    .edit-menu{border-bottom: 1px solid #ccc; text-align: right; font-size: 10px}
    li.submenu{height: 20px; }
    li.submenu a:not([href]) { color: #000; cursor: default; }
    .submenu-item { border-bottom: 1px solid #ccc; vertical-align: top}
    .bookmarker-hover-panel .submenu-child { display: none;left: 110px; position: relative; background: #fff; border: 1px solid #000; top: -20px; padding: 5px}
    .bookmarker-hover-panel .bookmarker-subreddit { width: 100%; display: block; }
    .bookmarker-hover-panel .bookmarker-subreddit:hover { background: #ccc }
    #bookmarker-settings { float: right; font-weight: bold; padding-right: 10px; }
    #bookmarker-settings-panel {display:none;position:absolute;margin:auto;top:100px;border: 1px solid #000;left:0;right:0; padding: 10px; width: 60%;min-height:50%;background:#FFFFFF;z-index:10000 }
    #bookmarker-settings-panel .close-icon { font-size: 14px; float: right; color: red}
    #bookmarker-bar .bookmarks { display: inline; }
    #header-bottom-left { margin-top: 41px; } /* push down reddit header to make space */
    .res-navTop #header-bottom-right { top: 41px } /* push down RES header */
    #bookmarker-settings .content form label, .content form th {
        padding-right: 5px;
        font-weight: bold;
    }
    #bookmarker-settings-panel .content h2, #bookmarker-settings-panel .content h3 { padding-bottom: 5px; }
    #bookmarker-settings-panel .content h2 { font-size: 20px; }
    #bookmarker-settings-panel .content h3 { font-size: 14px; }
    /* form#save-menu input:required {
        border: 1px solid red;
    } */
    .submenu-item { padding: 5px;}
    .submenu-item .form-group { display: flex; }
    .submenu-item .col { width: 33%; }
    .submenu-item .col:nth-child(1) { width: 40%; padding: 5px; }
    .submenu-item .col:nth-child(1) .form-row { display: flex; }
    .submenu-item .col:nth-child(1) label { width: 40%; }
    .submenu-item .col:nth-child(1) input { width: 60%; }
    .submenu-item .col:nth-child(2) { width: 60%; overflow-y: auto; height: 150px; }
    .submenu-item .col:nth-child(2) .form-group { flex-wrap: wrap; }
    .bookmarker-hover-panel .submenu .submenu-child { display: none; }
    .bookmarker-hover-panel .submenu:hover .submenu-child { display: block; }
`;
document.body.insertAdjacentHTML('beforeend',"<style>"+css+"</style>");

let menuHoverTemplate = `
    <div class='bookmarker-hover-panel' style='top: {$top}; left: {$left}'>
        <ul>
            <li class='edit-menu'>
                <a class='bookmarker-menu-edit' href='#'>Edit</a>
                <span class='separator'>|</span>
                <a class='bookmarker-menu-delete' href='#'>Delete</a>
            </li>
            {$subredditMenuItems}
        </ul>
    </div>
`;
let subredditLinkTemplate = `
        <a class='bookmarker-subreddit' {$subredditURL}>{$name}</a>
    `;
let subredditMenuItemTemplate = `
    <li class='submenu'>
        {$subredditLink}
        {$submenuChild}
    </li>
`;

let submenuChildTemplate =
    `
    <ul class='submenu-child'>
        {$subredditChildItems}
    </ul>
`;
let submenuChildItemTemplate =
    `
    <li>
        {$subredditLink}
    </li>
`;

let menuEditFormTemplate = `
    <form id='save-menu'>
        <input type='hidden' name='data-id' value='{$menuID}' required>
        <h2>Edit menu</h2>
        <h3>Parent menu</h3>
        <div class="form-group">
            <label>Subreddit</label><input tabindex="0" type='text' name='menu-subreddit' value='{$menuSubreddit}'>
            <label>Display name</label><input type='text' name='menu-name' value='{$menuName}' required>
        </div>
        <hr>
        <h3>Menu-items</h3>
        <div class="submenu-items">
            {$submenuItems}
        </div>
        <a class='add-submenu' href='#' tabindex="-1">Add menu-item</a>
        <hr>
        <button class='btn btn-success'>Save menu</button>
    </form>
`;
let menuEditFormItemsTemplate =
`
    <div class='submenu-item'>
        <h4>Menu-item</h4>
        <div class="form-group">
            <div class="col">
                <div class="form-row">
                    <label>Subreddit</label>
                    <input type='text' name='submenu-subreddit' value='{$submenuSubreddit}'>
                </div>
                <div class="form-row">
                    <label>Display name</label>
                    <input type='text' name='submenu-name' value='{$submenuName}' required>
                </div>
                <a tabindex="-1" href='#' onClick='(function(e){e.target.closest(\".submenu-item\").remove()})(arguments[0]);return false;'>Delete menu-item</a>
            </div>
            <div class="col">
                <h4>Submenus - <a href='#' class='child-menu-add' tabindex="-1">Add new</a></h4>
                <div class="form-group child-menu-items">
                    {$submenuChildItems}
                </div>
            </div>
        </div>
    </div>
`;

let menuEditFormSubmenuItemTemplate =
`
    <div class="form-row">
        <input type='text' name='submenu-subreddit' value='{$childmenuSubreddit}' required>
        <input type='text' name='submenu-name' value='{$childmenuName}' required>
        <a tabindex="-1" href='#' onClick='(function(e){e.target.closest(\".form-row\").remove()})(arguments[0]);return false;'>Delete</a>
    </div>
`;

let settingsWindowTemplate =
`
    <div id='bookmarker-settings-panel'>
        <a href='#' class='close-icon' onclick='document.querySelector(\"#bookmarker-settings-panel\").style.display=\"none\"'>X</a>
        <div class='content'></div>
    </div>
`;
let bookmarkBarTemplate =
`
    <div id='bookmarker-bar' style='top: {$top}'>
        <a href='#' id='bookmarker-add-current'>Add current</a>
        <span class='separator'>|</span>
        <div class='bookmarks'></div>
        <a href='#' id='bookmarker-settings'>Settings</a>
    </div>
`;

let menuParentItemTemplate = `
   <a data-id='{$id}' {$subredditURL}>{$name}</a><span class='separator'>|</span>
`;

let bookmarkerSettingsDefaultTemplate =
`
    <h2>General Settings</h2>
    <h3>Manage subreddits</h3>
    <ul>
        <li><a href='#' id='bookmarker-clear'>Delete all menus</a></li>
    </ul>
    <form id="bookmarker-settings-form">
        <div class="form-group">
            <div class="form-row">
                <label>Show Subreddits In Menus</label>
                <input type='checkbox' name='show-subreddit-names-in-menu' {$show-subreddit-names-in-menu}>
            </div>
        </div>
        <button class='btn btn-info'>Save</button>
    </form>
    <textarea id='bookmarker-json' style='width:800px;height:200px'>{$menuData}</textarea>
    <div class='alert alert-warning'>Don't edit here unless you know what you're doing</div>
    <button class='btn btn-danger' id='update'>Update Menu Data</button>
    <div>
        {$menuList}
        <button class='btn btn-info' id='export'>Export Menu/s</button>
    </div>
`;

let settingsMenuListTemplate =
`
    <div style='border: 1px solid #000'>{$settingsMenuListItems}</div>
`;

let settingsMenuListItemTemplate =
`
    <input type='checkbox' value='{$id}'><label>{$name}</label>
`;

function promptConfirm(text, confirmFunc = function(){}, cancelFunc = function(){}) {
    let confirmAct = confirm(text);
    if (confirmAct === true) {
        confirmFunc();
    } else {
        cancelFunc();
    }
}

function generateUniqueID() {
    const timeStamp = Date.now();
    let str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let Id = '';
    for (let i = 0; i < 7; i++) {
        let rom = Math.floor(1 +(str.length -1)*Math.random());
        Id += str.charAt(rom);
    }
    Id += timeStamp.toString();
    return Id;
}

function parseTemplate(template, replaces) {
    for(var [key, value] of Object.entries(replaces)) {
        if (key === 'subredditURL') {
            if (value.length)
                value = "href='/r/"+value+"'";
        }
        template = template.replaceAll("{$"+key+"}",value);
    }
    return template;
}

class Menu {
    constructor(id, name, subreddit, submenus) {
        this.id = id;
        this.name = name;
        this.subreddit = subreddit;
        this.submenus = submenus;
    }

    hover() {
        clearBookmarkerHovers();
        console.log('hovering');
        let menu = event.target;

        let top = menu.getBoundingClientRect().top;
        let left = menu.getBoundingClientRect().left;

        // Create div template
        let div = parseTemplate(menuHoverTemplate,{
            'top':(top+15)+"px",
            'left':left+"px",
        });

        let subredditMenuItems = "";
        for(var x = 0; x < this.submenus.length; x++) {
            let subMenu = this.submenus[x];
            let subMenuName = subMenu['name'];
            if (settings.get('show-subreddit-names-in-menu') && subMenu['subreddit'].length)
                subMenuName += " - (/r/"+subMenu['subreddit']+")";
            // Parse template for level 1 menu
            let subredditLink = parseTemplate(subredditLinkTemplate,{
                'name':subMenuName,
                'subredditURL':subMenu['subreddit']
            });
            let subredditMenuItem = parseTemplate(subredditMenuItemTemplate,{'subredditLink':subredditLink});

            // Parse template for level 2 menus
            let submenuList = "";
            if (subMenu['submenus'] && subMenu['submenus'].length) {
                for (let y = 0; y < subMenu['submenus'].length; y++) {
                    let childMenuName = subMenu['submenus'][y]['name'];
                    let childMenuSubreddit = subMenu['submenus'][y]['subreddit'];
                    if (settings.get('show-subreddit-names-in-menu') && childMenuSubreddit.length)
                        childMenuName += " - (/r/"+childMenuSubreddit+")";
                    submenuList += parseTemplate(submenuChildItemTemplate,
                        {'subredditLink':
                            parseTemplate(subredditLinkTemplate,{
                                'name':childMenuName,
                                'subredditURL':childMenuSubreddit
                            })
                        }
                    );
                }
                submenuList = parseTemplate(submenuChildTemplate,{'subredditChildItems':submenuList});
            }
            subredditMenuItems += parseTemplate(subredditMenuItem,{'submenuChild':submenuList});
        }
        // Parse final template and add to body
        div = parseTemplate(div,{'subredditMenuItems':subredditMenuItems});
        document.body.insertAdjacentHTML('beforeend',div);

        // Register events
        let panel = document.querySelector('.bookmarker-hover-panel');
        //div.insertAdjacentHTML('afterbegin',divHTML);
        panel.querySelector('.bookmarker-menu-edit').addEventListener('click',function(){menus[menu.getAttribute('data-id')].edit()});
        panel.querySelector('.bookmarker-menu-delete').addEventListener('click',function(){
            promptConfirm("Are you sure?",function(){menus[menu.getAttribute('data-id')].delete()});
        });
    }

    hoverSubmenu() {
        console.log('hover submenu');
    }

    edit() {
        let content = parseTemplate(menuEditFormTemplate,{
            'menuID':this.id,
            'menuName':this.name,
            'menuSubreddit':this.subreddit
        });
        let submenuItems = "";
        for (var x = 0; x < this.submenus.length; x++) {
            let menuItem = this.submenus[x];
            let submenuChildItems = '';
            if (menuItem.submenus && menuItem.submenus.length) {
                for (var y = 0; y < menuItem.submenus.length; y++) {
                    submenuChildItems += parseTemplate(menuEditFormSubmenuItemTemplate,{
                        'childmenuName' : menuItem.submenus[y].name,
                        'childmenuSubreddit' : menuItem.submenus[y].subreddit
                    });
                }
            }
            submenuItems += parseTemplate(menuEditFormItemsTemplate,{
                'submenuName' : menuItem.name,
                'submenuSubreddit' : menuItem.subreddit,
                'submenuChildItems' : submenuChildItems
            });
        }
        content = parseTemplate(content,{'submenuItems':submenuItems});
        toggleSettingsPanel('menu-edit',content);
    }

    validate(form) {
        this.name = form.querySelector('[name=menu-name]').value;
        this.subreddit = form.querySelector('[name=menu-subreddit]').value;

        let submenus = form.querySelectorAll('.submenu-items .submenu-item');
        this.submenus = [];
        for(var x = 0; x < submenus.length; x++) {
            let submenu = {
                'name':submenus[x].querySelector('[name=submenu-name]').value,
                'subreddit':submenus[x].querySelector('[name=submenu-subreddit]').value,
                'submenus':[]
            };
            let childMenuItems = submenus[x].querySelectorAll('.child-menu-items .form-row');
            console.log(childMenuItems);
            for(var y = 0; y < childMenuItems.length; y++) {
                submenu.submenus.push({
                    'name':childMenuItems[y].querySelector('[name=submenu-name]').value,
                    'subreddit':childMenuItems[y].querySelector('[name=submenu-subreddit]').value,
                });
            }
            this.submenus.push(submenu);
        }
        return true;
    }

    save() {
        let currentMenus = getAllMenus();
        let id = this.id;
        if (!id)
            id = generateUniqueID();
        if (!currentMenus[id])
            currentMenus[id] = {};
        currentMenus[id] = {
            'name': this.name,
            'subreddit': this.subreddit,
            'submenus': this.submenus,
        }
        setData(bookmarks, currentMenus);
        redrawMenus();
        console.log('save');
    }

    delete() {
        let currentMenus = getAllMenus();
        delete currentMenus[this.id];
        setData(bookmarks,currentMenus);
        redrawMenus();
        delete menus[this.id];
    }
}

function copyEmptyInput(inputFrom, inputTo) {
   if (!inputTo.value && inputFrom.value)
        inputTo.value = inputFrom.value;
    console.log(inputFrom);
    console.log(inputTo);
}

function downloadJSON(content, fileName = 'menu.json', contentType = 'text/plain') {
    var a = document.createElement("a");
    var file = new Blob([JSON.stringify(content)], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}


// delete when other funcs moved
function addSubMenu(target, value = '') {
    let items = target.closest('.form-group').querySelector('.child-menu-items');
    items.insertAdjacentHTML('beforeend',
        parseTemplate(menuEditFormSubmenuItemTemplate,{
            'childmenuName': value,
            'childmenuSubreddit': value
        })
    );
    console.log(items);
}

function toggleSettingsPanel(mode = 'main', innerContent) {
    let panel = document.getElementById('bookmarker-settings-panel');

    if(panel.style.display === 'none' || !panel.style.display)
        panel.style.display = 'block';
    else
        panel.style.display = 'none';

    let currentMenus = getAllMenus();
    console.log(currentMenus);
    let menuListItems = "";
    for (var [key, values] of Object.entries(currentMenus)) {
        console.log(key);
        menuListItems += parseTemplate(settingsMenuListItemTemplate,{
            'id': key,
            'name': values.name
        });
    }
    let allSettings = settings.all();
    let settingsReplaces = {
        'menuData':JSON.stringify(getData(bookmarks)),
        'menuList': parseTemplate(settingsMenuListTemplate,{
            'settingsMenuListItems': menuListItems
        })
    };

    for ([key, values] of Object.entries(allSettings)) {
        settingsReplaces[key] = values ? "checked='checked'" : "";
    }
    console.log(settingsReplaces);
    let content = parseTemplate(bookmarkerSettingsDefaultTemplate,settingsReplaces);

    if (mode) {
        switch(mode) {
            case 'main'        : break;
            case 'menu-edit'   : content = innerContent;
                                 break;
        }
    }
    panel.querySelector('.content').innerHTML = content;

    if (mode && mode == 'menu-edit') {
        let childMenuBtns = panel.querySelectorAll('.child-menu-add');
        for (x = 0; x < childMenuBtns.length; x++) {
            childMenuBtns[x].addEventListener('click',function(e){addSubMenu(e.target)});
        }
        let subredditInputs = panel.querySelectorAll('[name=submenu-subreddit]');
        for (x = 0; x < subredditInputs.length; x++) {
            subredditInputs[x].addEventListener('blur',function(e){
                let from = e.target;
                let to = e.target.parentNode.closest('.col').querySelector('[name=submenu-name]');
                console.log(from);
                console.log(to);
                copyEmptyInput(from,to);
            });
        }

        panel.querySelector('.add-submenu').addEventListener('click',function(e){
            var m = parseTemplate(menuEditFormItemsTemplate,{
                'submenuName' : '',
                'submenuSubreddit' : '',
                'submenuChildItems' : ''
            });

            panel.querySelector('.submenu-items').insertAdjacentHTML('beforeend',m);
            let childMenuBtns = panel.querySelectorAll('.child-menu-add');
            for (x = 0; x < childMenuBtns.length; x++) {
                childMenuBtns[x].addEventListener('click',function(e){addSubMenu(e.target)});
            }
        });
        panel.querySelector('form#save-menu').addEventListener('submit',function(e){
            e.preventDefault();
            let form = e.target;
            let menu = menus[form.querySelector('[name=data-id]').value];
            let validate = menu.validate(form);
            if (validate) {
                menu.save();
                redrawMenus();
                panel.style.display='none';
            }
            console.log(panel);
        },false);
    }
    if (!mode || (mode && mode == 'main')) {
        // Main settings panel events
        panel.querySelector('a#bookmarker-clear').addEventListener('click',
            function(){
                promptConfirm("This will delete all of your shortcuts. Confirm you want this.",
                    function(){
                        clearAllShortcuts();
                    }
                )
        });
        panel.querySelector('button#export').addEventListener('click',
            function(){
                //let selectedItems = document.querySelector('#bookmarker-settings-panel')
                downloadJSON(getAllMenus());
            }
        );
        panel.querySelector('button#update').addEventListener('click',
            function(){
                promptConfirm("This will overwrite all of your current shortcuts. Confirm you want this",
                    function(){
                        let json = panel.querySelector('textarea#bookmarker-json');
                        if (json) {
                            json = JSON.parse(json.value);
                            setData(bookmarks,json);
                            redrawMenus();
                        }
                    }
                )
            }
        );
        panel.querySelector('form#bookmarker-settings-form').addEventListener('submit',
            function(e){
                e.preventDefault();
                console.log(e.target);
                let inputs = e.target.querySelectorAll('input');
                for(x = 0; x < inputs.length; x++) {
                    let setting = inputs[x];
                    let settingName = setting.getAttribute('name');
                    let settingValue = null;
                    switch(setting.type) {
                        case 'checkbox' :   if (setting.checked)
                                                settingValue = true;
                                            else
                                                settingValue = false;
                                            break;
                        default         :   settingValue = setting.value;
                                            break;
                    }

                    settings.set(settingName, settingValue);
                    console.log(settings);
                }
            }
        );

    }
}

function getCurrentSubreddit() {
    let path = window.location.pathname.split('/').filter(function(a){return a != '';});

    if (path[0] == 'r' && path[1].indexOf('+') === -1)
        return path[1];
    return null;
}

function redrawMenus() {
    let savedBookmarks = getAllMenus();
    let bookmarkBar = document.getElementById('bookmarker-bar');
    let bookmarkDiv = bookmarkBar.querySelector('.bookmarks');
    menus = {};
    bookmarkDiv.innerHTML = "";
    console.log(bookmarkBar);
    for(var key in savedBookmarks) {
       let name = savedBookmarks[key]['name'];
       let subreddit = savedBookmarks[key]['subreddit'];
       bookmarkDiv.insertAdjacentHTML('beforeend',parseTemplate(menuParentItemTemplate,{
            'id': key,
            'name': name,
            'subredditURL': subreddit
        }));
        let menu = new Menu(key,name,subreddit,savedBookmarks[key]['submenus']);
        menus[key] = menu;
    }
    let bookmarkLinks = bookmarkDiv.querySelectorAll('a');
    console.log(menus);
    for(var x = 0; x < bookmarkLinks.length; x++) {
        bookmarkLinks[x].parentNode.addEventListener('mouseover',function(e) {
            let menu = menus[e.target.getAttribute('data-id')];
            if (menu)
                menu.hover();
        });
        //bookmarkLinks[x].addEventListener('mouseleave',function(e) {
        //    clearBookmarkerHovers();
        //});
    }
}

function getAllMenus() {
    return getData(bookmarks);
}

function clearAllBookmarks() {
    setData(bookmarks,{});
    console.log('Cleared bookmarks');
    redrawMenus();
}

function setData(key, value) {
    GM_setValue(key, value);
}

function getData(key) {
    return GM_getValue(key);
}

function clearBookmarkerHovers() {
    let hovers = document.body.querySelectorAll('.bookmarker-hover-panel');
    for (var x = 0; x < hovers.length; x++) {
        hovers[x].parentNode.removeChild(hovers[x]);
    }
}

// 1 = old, 2 = new
function getRedditVersion() {
    return document.querySelector('#sr-header-area') ? 1 : 2; 
}

class Settings {
    constructor(settingsIn){
        this.settings = settingsIn;
    }

    load(){
        let data = getData('settings');
        //data = false;
        if (data)
            this.settings = data;
    }

    all() {
        return this.settings;
    }

    save() {
        setData('settings',this.settings);
    }

    set(setting, value) {
        this.settings[setting] = value;
        this.save();
        console.log(this.settings);
    }

    get(setting) {
        return this.settings[setting];
    }
}

(function() {
    'use strict';
    let loaded = false;

    window.addEventListener('load', (event) => {
        if (!loaded) {
            loaded = true;
            console.log('window loaded');
            let content = document.body;

            // Add settings window
            let settingsWindow = settingsWindowTemplate;
            content.insertAdjacentHTML('beforeend',settingsWindow);

            settings = new Settings(defaultSettings);
            settings.load();

            // Add bookmark bar
            let header;
            let top;
            switch(getRedditVersion()) {
                case 1 :  header = content.querySelector('#sr-header-area');
                            top = "20px";
                            break;
                case 2 : header = content.querySelector('header');
                            top = "50px";
                            break;
                default: break;
            }
            let bookmarkBar = parseTemplate(bookmarkBarTemplate,{'top':top});
            header.insertAdjacentHTML('afterend',bookmarkBar);
            document.querySelector('#bookmarker-bar #bookmarker-add-current').addEventListener('click',function(){
                    var subreddit = getCurrentSubreddit();
                    let menu = new Menu(null, subreddit, subreddit, []);
                    menu.save();
                });

            // Register settings eventListeners
            document.getElementById('bookmarker-settings').addEventListener('click',function(){
                toggleSettingsPanel('main')
            });
            //clearAllBookmarks();
            redrawMenus();

        }
    });
})();

