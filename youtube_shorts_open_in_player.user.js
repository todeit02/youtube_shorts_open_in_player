// ==UserScript==
// @name                youtube-shorts-open-in-player
// @version				0.0.1
// @namespace	        https://github.com/todeit02/youtube_shorts_open_in_player
// @description	        Adds a "watch" button to YouTube shorts for opening them as a regular YouTube video.
// @grant				GM.xmlHttpRequest
// @grant				GM_xmlhttpRequest
// @grant               GM.getResourceUrl
// @grant               GM_getResourceUrl
// @include				/^https:\/\/(?:www\.)?youtube\.com\/shorts\/.*$/
// @require				https://polyfill.io/v3/polyfill.min.js?features=Array.prototype.at
// @resource            button https://raw.githubusercontent.com/todeit02/youtube_shorts_open_in_player/master/button.html
// @resource            buttonStyles https://raw.githubusercontent.com/todeit02/youtube_shorts_open_in_player/master/button.css
// @run-at              document-end
// @connect				*
// ==/UserScript==


"use strict";

(async () =>
{
    const watchButtonStylesheetUrlPromise = GM.getResourceUrl("buttonStyles");
    const watchButtonContainerTemplatePromise = loadWatchButtonContainerTemplate();

    const shareButtonContainer = await waitForShareButtonContainer();

    const watchButtonStylesheetUrl = await watchButtonStylesheetUrlPromise;
    insertWatchButtonStylesheet(watchButtonStylesheetUrl);

    const watchButtonContainerTemplate = await watchButtonContainerTemplatePromise;
    insertWatchButton(shareButtonContainer, watchButtonContainerTemplate);

    // Using custom observer because popstate does not fire.
    const locationObserver = LocationChangeObserver(async location =>
    {
        const actionsBar = findCurrentActionsBar(location);
        if(!actionsBar.querySelector(".userscript-watch-button")) insertWatchButtonIntoActionsBar(actionsBar);
    });
    locationObserver.observe();


    async function waitForShareButtonContainer()
    {
        return new Promise((resolve, reject) =>
        {
            const domObserver = new MutationObserver(async mutations =>
            {
                // Watching all these mutations is not optimal yet.
        
                const addedNodes = mutations.flatMap(mutation => [...mutation.addedNodes]);
                const shareButtonExists = addedNodes.some(node => node.closest("#share-button"));
                if(!shareButtonExists) return;
        
                domObserver.disconnect();
                
                const shareButtonContainer = document.querySelector("#actions #share-button");
                if(shareButtonContainer) resolve(shareButtonContainer);
                else reject();
            });
        
            domObserver.observe(document.querySelector("ytd-page-manager"), {
                childList: true,
                subtree: true,
            });
        });
    }


    async function insertWatchButtonIntoActionsBar(actionsBar)
    {
        const shareButtonContainer = actionsBar.querySelector("#share-button");

        const watchButtonContainerTemplate = await watchButtonContainerTemplatePromise;
        insertWatchButton(shareButtonContainer, watchButtonContainerTemplate);
    }


    async function loadWatchButtonContainerTemplate()
    {
        const buttonUrl = await GM.getResourceUrl("button");

        const buttonHtml = await gmFetch(buttonUrl);
        const parser = new DOMParser();
        const parsedDocument = parser.parseFromString(buttonHtml, "text/html");

        return parsedDocument.querySelector("template")
    }


    function insertWatchButtonStylesheet(url)
    {
        const watchButtonCssLink = document.createElement("link");
        watchButtonCssLink.id = "userscript-watch-button-style";
        watchButtonCssLink.rel = "stylesheet";
        watchButtonCssLink.href = url;
        document.head.append(watchButtonCssLink);
    }


    function insertWatchButton(siblingShareButtonContainer, watchButtonContainerTemplate)
    {
        const shareButtonRenderer = siblingShareButtonContainer.querySelector("ytd-button-renderer");
        const shareButton = siblingShareButtonContainer.querySelector("button");

        const watchButtonContainer = watchButtonContainerTemplate.content.cloneNode(true).firstElementChild;
        const watchButton = watchButtonContainer.querySelector("button");
        
        watchButton.addEventListener("click", () =>
        {
            const videoId = window.location.pathname.split('/').at(-1);
            const videoPlayerPageUrl = new URL("/watch", window.location.origin);
            videoPlayerPageUrl.searchParams.set("v", videoId);

            window.open(videoPlayerPageUrl.href, "_blank");
        });
        
        watchButtonContainer.style.paddingTop = window.getComputedStyle(shareButtonRenderer).paddingTop;
        watchButton.style.width = shareButton.scrollWidth + "px";
        watchButton.style.height = shareButton.scrollHeight + "px";
        watchButton.style.borderRadius = window.getComputedStyle(shareButton).borderRadius;
        
        siblingShareButtonContainer.insertAdjacentElement("afterend", watchButtonContainer);  
    }


    async function gmFetch(url)
    {
        return new Promise((resolve, reject) =>
        {
            GM.xmlHttpRequest({
                method: "GET",
                url,
                onload: response => resolve(response.responseText),
                onerror: response => reject(response.responseText),
            });
        });
    }


    function LocationChangeObserver(listener)
    {
        let previousUrl = null;

        function observe()
        {
            previousUrl = window.location.href;
            window.setInterval(() =>
            {
                const currentLocation = window.location;
                const currentUrl = currentLocation.href;
                if(previousUrl === currentUrl) return;

                previousUrl = currentUrl;
                listener(currentLocation);
            }, 100);
        }

        return { observe };
    }


    function findCurrentActionsBar(location)
    {
        return [...document.querySelectorAll("#actions")].find(actionsElement =>
        {
            const playerContainer = actionsElement.closest("ytd-reel-video-renderer")?.querySelector(".player-container");
            if(!playerContainer) return false;

            const playerContainerImageSrc = window.getComputedStyle(playerContainer).backgroundImage;
            const playerContainerImageUrl = /url\("(.*)"\)/.exec(playerContainerImageSrc)?.[1];
            if(!playerContainerImageUrl) return false;

            const playerContainerImageVideoId = playerContainerImageUrl.split('/').at(-2);
            const urlVideoId = location.pathname.split('/').at(-1);
            return (playerContainerImageVideoId === urlVideoId);
        });
    }
})();
