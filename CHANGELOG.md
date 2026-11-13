# Changelog

The release build copies the section of the version it publishes into the GitHub release,
and EDCH shows it in the update banner.

## Unreleased

- Controls: optional French/English action names for all 420 known actions, including the keyboard, controller diagrams and function picker; searches work in both languages and bindings remain unchanged.

## 0.10.12

- New share mode switch in the top bar (also on the Sync page): Normal, BGS or Invisible. BGS keeps your BGS work private: EDDN, EDSM and Inara no longer get the factions, their influence, states and conflicts, nor your missions, vouchers, trade or data sold (jumps, scans and markets are still shared). Invisible shares nothing at all. The mode stays as you set it after a restart, and switching drops what was still waiting to be sent. It only hides what you send: other players in the same system can still share its state.
- Colonisation: new "To source" column (and total): what is still to buy or find once your hold and your carriers are delivered.
- Colonisation: your squadron's carrier is shown and counted only when "Show the squadron carrier" is ticked (kept after a restart).
- Fixed: Colonisation showed wrong carrier quantities after taking goods back from a carrier or buying from its market (an old market stock kept hiding the change). The stock a carrier's market offers now raises the hold estimate once, when you look at it, and every later transfer or trade counts from there, after a restart too.
- Fixed: donating tritium to a carrier's fuel no longer removes it from the carrier's hold (it comes from your ship's hold).
- Fixed: the ship's hold counted a commodity only once when the game listed it on several lines (mission cargo).
- Fixed: war and civil war massacre missions ("kill … in a conflict zone") never counted their kills: the combat bonds of a conflict zone now count, one mission at a time per issuing faction like the game. In a wing, your wingmates' kills count in the game but aren't in your journal: the counter can be behind until the game marks the mission done (the Missions page says so).
- Controls: each controller picture shown is kept on the PC, unchanged (full quality), in EDCH's folder, so the page shows it at once next time, offline too, instead of downloading 1.3 MB from GitHub each time.
- Controls: the controller picture no longer sits on a white background: the white blends into the page, and on dark themes the picture is shown light on dark. Printing still gives the original picture on white.
- Controls: new "Configure" button. It makes a copy of the presets the game uses now, named "…_EDCH" (the game's own presets are never changed), then a click on a control of the drawing, or a press on it on your device, lets you give it a function. A control already used is reported first (replace or keep both), and the function takes its first free slot. Each change is saved at once in the copy; your Bindings folder is backed up before the first one. Choose the copy in the game (Options → Controls) to use it. Axes can't be configured yet.
- Controls: press a button, hat or key while EDCH has the focus, and the page shows what it does and highlights it on the drawing.
- Controls: the game's default presets (KeyboardMouseOnly…) are now shown too: EDCH reads them, read-only, from the game's installation (ControlSchemes). It's the only file of the game's installation EDCH touches (the READMEs say so).
- Fixed: Controls' "Zoom in / out" left you stuck in the top-left corner of the picture: the zoomed picture now scrolls both ways and can be dragged with the mouse.
- Fixed: Colonisation could show goods on a squadron carrier that others had already taken (your journal only sees your own transfers). When you open its market, the squadron carrier's hold now becomes what the market sells; your own carrier keeps its estimate, raised by the market. The stock for sale shown no longer counts goods you took back to your ship.
- Linux: with NVIDIA's own driver, EDCH's window no longer stays blank or crashes ("GBM" errors): the usual WebKitGTK workaround (WEBKIT_DISABLE_DMABUF_RENDERER) is turned on by itself, unless you set it yourself.
- About: a new section thanks EDCH's contributors.
- Station search results (Search page and finders) show each station's type as an icon: Coriolis, Orbis, Ocellus, Dodec, outpost, asteroid base, megaship, carriers, planetary port and outpost, settlement, construction depot. Most icons come from EDAssets (credited in About).
- Everything that loads (searches, routes, markets…) now shows the game-style triangle loader from EDAssets, in your theme's colour.
- Controls: device data updated to EDRefCard's maintained version (edrefcard2): 19 more devices drawn on their picture (Thrustmaster TCA Sidesticks and TPR pedals, VKB STECS and Gladiator NXT Premium OTA, Virpil Alpha Prime, FLNKR, MongoosT throttles and Control Panel #2, Winwing Ursa Minor Fighter and Orion 2 F18 handle…), more ids recognised (Xbox Elite Series 2…), corrected templates (T.16000M, X56 throttle, G940 pedals…) and the newer Odyssey controls named (emotes, grenades, battery and medkit, walk, free camera, field neutraliser…).
- Safety: importing a configuration zip now checks everything first (size, number of files, file names, contents, duplicates) and writes the files aside before putting them in place, so a broken or hostile zip can't fill the memory or leave a half-imported configuration.
- Safety: web requests follow a redirection only to the same allowed sites, and never repeat an address (which can hold a key) in an error message.
- Safety: an update is installed only when its SHA-256 checksum, published by GitHub, matches.
- Safety: the game's companion files (Status.json, Market.json…) are read only from the journal folder, and only those files.
- Safety: the remote access server answers "busy" past a number of requests at once, instead of piling them up.
- Safety: what a phone sends (settings, colours, wishlist) and what wing members send is checked field by field before EDCH uses it.
- Privacy: the logs no longer show other commanders' names (wing) or IPv6 addresses.

## 0.10.11

- Session: going back to the main menu and in again no longer starts a new session (jumps, mining, missions… went back to zero). A session now ends when the game closes or starts again.
- Session: bounties and combat bonds (Thargoids included) now count as soon as you get them, not only once cashed in at a station, and a line shows what is left to cash in.
- Wishlist: new "Export my ship to EDSY" (or Coriolis) button. It opens your current ship, as the game's journal describes it (engineering done since included), in the build site chosen in Settings → Preferences.
- Settings: new Preferences tab, with the language and start page, how pages open (Wishlist mode, Navigation route type, a click on a system), the Controls page's keyboard, the ship export site, and the Spansh system search settings (moved from the other tabs).
- New "Reset counters" button on the pages with session counters: Session (credits earned and activity), Mining ("This session": tonnes refined, prospectors, asteroids…; the last asteroids stay) and Powerplay (merits this session). The counters start again from zero until the next game session, even after restarting EDCH.
- Fixed: "Already done on this ship" missed a module the game mounts in another slot than the build tool (EDSY, Coriolis) put it: when the build's slot holds another module type, the whole ship is checked for that module type.
- Settings → Updates: the installed version is the exact one ("0.10.11-pre.83 (pre-release)" for a test build). An "Update available" button shows next to "Check now" when GitHub has an update for this build (checked quietly when Settings opens, no notification). With "Also offer pre-releases" unticked on a test build, the latest release is offered, even if older, to go back to the stable version.
- New in About: "Help complete the data". When the game shows engineering EDCH's data doesn't know (an engineer doing a grade the data doesn't give them, a module or a modification missing from the data, like the Guardian weapons' or the caustic sink launchers'), EDCH notes it, once per item, in a list and in missing-data.txt in the logs folder. "Send in a GitHub issue" opens an issue already filled with the list. Once it's sent, EDCH finds the issue on GitHub by itself (a random report id in it, checked every 15 minutes) and the sent items leave the list; deleting missing-data.txt also starts a new list. No private data in it: engineers, modules, modifications, grades, dates and the game's version only.
- Engineers: the game now completes EDCH's data. Each engineering in the journal (who did which modification, on which module, at which grade) is remembered, past sessions included; when an engineer did a modification or a grade the data doesn't give them, the wishlist and the tour count it from then on, and the log notes the gap so the data can be fixed. The journal only shows what was done: a grade an engineer can't do (lower than the data says) still has to be fixed by hand.
- Fixed: "Already done on this ship" missed a modification when the wishlist line came from a build imported before 0.10.10, which had merged other modules into it (the heat sink launcher's Ammo Capacity with the caustic sink launchers: 4 asked, 1 on the ship). Only modules of the line's type count now, and a line asking more of them than the ship has is done once all of those are.
- New Thargoids page: the Thargoids you killed, by ship type (scouts, Glaive / Scythe, Cyclops, Orthrus, Basilisk, Medusa, Hydra), this session and over the last 60 days of journal, with their bonds, and the AX conflict zones entered this session. The game's journal doesn't name the Thargoid killed: the type is recognised from its combat bond. A "Reset counters" button restarts the session's count.
- ARM builds now come with releases too: Windows on ARM (installer and portable exe, "arm64") and Linux on ARM (AppImage, .deb, .rpm, "aarch64"). EDCH 0.10.10 and later update to the build of their processor. Still on 0.10.9 or older on an x64 PC: install this version by hand (EDCH_0.10.11_x64-setup.exe), the automatic update of those versions may pick the ARM installer.
- Notifications panel: each notification has a remove button (×), and "Clear all" empties the list (the tab's counter and flash too).

## 0.10.10

- Engineer data checked against the game and community wikis: Lori Jameson does Life Support up to G4, not G5 (G5 is only Etienne Dorn, in Colonia); Juri Ishmaak also does the manifest, wake and kill warrant scanners up to G3. The other ship engineers match.
- Engineer tour: when the wanted grade isn't reachable in your region (Life Support G5 outside Colonia), the line shows "G4 max in your region" at the best engineer there, and counts as done once your module has that grade.
- Build import: Guardian weapons (plasma charger, gauss, shard cannon) and caustic sink launchers are no longer taken for ordinary modules (an Overcharged Guardian plasma charger showed as "Beam Laser — Overcharged"). Their engineering isn't in the data yet, so they are listed as skipped. Re-import your build to clean the old lines.
- The automatic update now picks the installer of your processor's kind (x64 or ARM), ready for the ARM builds: they are published with test builds for now, and with releases from 0.10.11.
- Fixed: "Already done on this ship" missed modifications made at an engineer during the session (for example Heavy Duty G5 on the armour). The game doesn't rewrite the ship's module list after engineering; EDCH now updates the module from each engineering (grade, blueprint, experimental effect), so the line and the engineer leave the tour at once.

## 0.10.9

- Settings → Updates: new option "Also offer pre-releases (test versions)". Ticked, EDCH also offers the test builds published before a release, and installs them like any update; a pre-release is followed by the next one, then by its release. Unticked (default), only releases are offered, as before.

## 0.10.8

- Engineer tour with fewer stops: each line now goes to an engineer already in the tour when one can do it, the hardest lines (grade 5, few engineers) deciding the stops. An experimental effect goes with its module's modification: no detour to a low-grade engineer for an effect (or a low-grade modification) the grade 5 engineer of that module also does. The wishlist lines show the same engineer as the tour.
- Imported builds (EDSY, Coriolis, journal) now remember each module's slot: an experimental effect stays tied to its own module's modification. For each module of the build, the tour checks your ship (when you fly that ship type): if the module doesn't have the modification at the wanted grade yet, you go to the engineer reaching that grade for the modification and the effect together; if it already has it, only the effect is left, at the nearest engineer able to apply it. Stopping at a lower-grade engineer on the way doesn't change the destination; an effect applied there is marked done. Re-import your builds to get this (older lines are checked by module type).
- Fixed: "Already done on this ship" now checks the module type. The game names some blueprints the same for every weapon (Overcharged, Long Range…), so an Overcharged multi-cannon made an Overcharged beam laser line look done.
- When the tour's current stop is no longer needed after this regrouping, the tour says so and offers to go to the next engineer.
- Fixed: the next system wasn't copied while you played (engineer tour, and the route's next system on arrival). Windows refused the copy while EDCH's window wasn't in front; EDCH now writes the clipboard itself.
- Fixed: an engineer tour stop now ends as soon as its modules reach the wanted grade, even in fewer rolls than planned, so the next engineer's system is copied.
- New option in Settings → Game and search → Navigation (on by default, Windows only): when the Elite Dangerous window comes back to the front, the next system to enter is copied (the next system of the route in progress, or the engineer of the tour you are heading to).
- Mining, "Where to mine": a new "Mining type" column says, for each planet's ring, how the mineral is mined there (laser, subsurface, core). Core only shows on the ring types where the mineral has motherlode asteroids.
- Mining: the laser, subsurface and core chips above the table are now switches. Click one to hide that mining type from the results (rings left with no type shown are hidden), click it again to show it. The choice is kept.
- Mining: as soon as you prospect an asteroid, the "Last asteroid" card moves to the top of the page. A switch in the card shows the last asteroid only, the last 3 (default) or the last 5.
- Mining: the asteroid's material content (Low, Medium, High) is shown in your language, and percentages use your language's decimal separator.

## 0.10.7

- Search: new **Faction** tab. Type a minor faction (suggestions from the factions met in your journal), choose "present in the system" or "controls the system", and tick the faction states you want (Famine, Expansion, War…, with the game's names in your language). The systems come nearest first, with the faction's influence, its states, who controls the system and how old the data is; a click copies the system.
- Engineer tour, stop by stop: no more route calculation. The tour is the list of engineers to visit (nearest first, then nearest to the previous one), with their system; you plot each leg in the game. Click an engineer (or "Start the tour"): their system is copied. EDCH notes when you arrive there, and once every line of that stop is done, it copies the next engineer's system by itself (with a notification if you turned them on). "Go to the next engineer" moves the current one to the end of the tour.
- Wishlist: lines your current ship already has (blueprint at the wanted grade or higher, experimental effect) show as "Already done on this ship", leave the tour and the materials needed, and an engineer with nothing left to do leaves the tour.
- Wishlist: new **Simple / Advanced** switch at the top. Advanced (default) shows every line with its grades and the materials needed; Simple shows only the engineer tour. The default is set in Settings → Game and search → Engineers.
- Translations: the engineers' requirements (how to meet and unlock them, who refers them) and the farming sites are now translated in every language, with the game's names for ranks, reputations and goods. Faction states are shown with the game's names too, and numbers use your language's decimal separator.

## 0.10.6

- About: a new "Support EDCH" card. EDCH stays free and without ads; if it helps you, the button opens the project's Ko-fi page. The card also says how EDCH is made: designed, tested and maintained by CMDR MDLuffy, developed with the help of the AI Claude (Anthropic).
- No other visible change: code tidying (data sharing with EDDN, EDSM and Inara split by service, stricter checks of the backend code).

## 0.10.5

- Menu: About and Settings now stay at the very bottom of the menu, apart from the pages you arrange.
- Edit menu: "Add a line" adds a separating line (drag it between two pages), and the × next to a line removes it.
- Edit menu: the phone and eye switches no longer get cut off at the right edge.
- One look for every field and button: drop-down lists, text and number fields now look the same on every page (some were still drawn by Windows, grey and square, like the mineral list in Mining), and buttons and fields share the same heights.

## 0.10.4

- The menu is now sorted by use in game, in groups separated by a line: Missions, Navigation, Search · Colonisation, Mining, Exploration, Powerplay, Community goals, Session · Wishlist, Engineers, Materials, Engineering, Odyssey · Controls, Remote access, Sync · About, Settings.
- New "Edit menu" button at the bottom of the menu (also in Settings → Display): drag pages (or the lines between groups) to reorder them, switch each page on or off for the phone, hide or show it. "Original order" puts the groups back. Your choices are kept and followed by the phone.
- Remote access, Sync, Settings and About never show on the phone: they manage the PC itself.
- Translations rebuilt on i18next: every text now has a stable key and its own entry in each language (English is the reference and the fallback), with real plurals ("1 event", "2 events"). Texts that stayed in French in other languages are now translated: device names, mouse buttons and axes, engineer ranks, "Referred by", error messages from the app's core (network, download, files) and a few others. See docs/TRANSLATING.md to help translate.
- Faster "is the game running?" check: on Windows it reads the process list directly instead of starting tasklist every 10 seconds; on Linux it stops at the first match.
- The last messages still in French in other languages are translated (journal folder empty, unreadable zip, game options folder not found).
- Code reorganised for contributors (no visible change): the UI in layers with one folder per page, the stylesheet and the Rust backend split into modules, automatic checks for formatting, layers and translations, and docs/ARCHITECTURE.md and CONTRIBUTING.md.

## 0.10.3

- Navigation: new **exact route with fuel**, now the default (Spansh Galaxy Plotter). It is plotted with your ship as the journal describes it (drive and its engineering, masses, tanks, Guardian FSD Booster, cargo): every jump is possible with the fuel left, the route shows the fuel in the tank after each jump, the stars you can scoop, and where you **must refuel**. Options: priority (fewest jumps, follow the neutron route, fast calculation, save fuel), neutron stars, already supercharged, FSD Injection, avoid secondary stars, refuel at every scoopable star, and the Caspian's ×6. A warning shows when your ship has no Fuel Scoop. The quick neutron route is still one click away.
- Fixed: after a visit to Colonisation (and on some other pages that wait for Spansh, EDSM or Inara), the page could come back by itself over the one you were on, for example over Navigation. A page you left now stays closed, and Colonisation stops refreshing your carriers' markets once you leave it.
- A second click on "Plot the route" (engineer tour, ship route, carrier route) while Spansh is still working no longer starts the same calculation again.

## 0.10.2

- Neutron routes for the Caspian Explorer: its Mk II drive gets ×6 from neutron stars instead of ×4. EDCH now tells Spansh, so routes use far fewer jumps. On the Navigation page the "Neutron boost ×6" box is ticked by itself when your ship has that drive, and can be unticked to plot for another ship. The engineer tour uses it too.
- Navigation: "Use my current ship" fills in the departure, your current jump range and the neutron boost from the ship you are flying.
- The Windows installer now shows what EDCH sends and to whom (Spansh, EDSM, EDDN, Inara, ntfy, GitHub) and how to turn each one off, followed by the MIT licence.
- New code signing policy page with the privacy policy, linked from the README, ahead of free code signing by the SignPath Foundation (application in progress). Signed builds will stop Windows Defender from wrongly flagging the installer.
- The loading spinner showed as a thin line in some places (engineer tour, searches): it is round again everywhere.
- Phones: the Controls page no longer runs past the right edge (search bar, notices), and the Mining search form wraps instead of being cut off.

## 0.10.1

- Navigation: when you arrive in a system of the ship route, the next one can be copied automatically, ready to paste into the galaxy map.
- New Settings → Game and search → Navigation card: auto-copy for the Navigation route, auto-copy for the engineer tour (moved here from the Engineers card), and a notification when the next jump is copied.
- Controls: the keyboard drawn by default follows the app's language (AZERTY in French, QWERTZ in German, QWERTY otherwise; ANSI in English, ISO otherwise). The switch is still there and your choice is kept.
- About: a word from the author, CMDR MDLuffy.

## 0.10.0

- Wishlist: each line shows the engineer to visit, and their name copies the workshop's system. For a modification, the nearest engineer you know who reaches the wanted grade, otherwise the best grade available (an engineer's own maximum counts, even if your rank with them is lower for now). For an experimental effect, simply the nearest engineer you know. Engineers you know but haven't unlocked are marked "to unlock"; a click shows what the game asks for. When nobody you know can do a line, the line turns red.
- Engineer tour: the stops of the wishlist, nearest first from where you are, with what to do at each one and the materials still missing (stops you can't complete yet are greyed out). Spansh plots each leg with your ship's jump range, so the jumps really follow one another.
- Optional: copy the next jump of the tour as soon as you arrive in a system of the route.
- When the game applies a modification or an experimental effect, the matching wishlist line moves on by itself, and is removed once done.
- The Bubble and Colonia are kept apart: engineers of the other region are left out, and the tour has a maximum length.
- New Settings → Game and search → Engineers card to turn each of these on or off.
- New "Day (light)" theme. With a light background the whole interface switches to dark text, and colours too light (or too dark) to read are adjusted by themselves.

## 0.9.9

- Clicking an engineer copies the system of their workshop: on the engineer's name in Engineers, and wherever engineers are listed (Engineering, wishlist).
- Searches ignore accents and case everywhere ("energie" finds "Énergie"). On the Search page, a name can be typed in the app's language or in English, or only partly: EDCH finds the game's name, or lists the names that match when there are several. An older, slower answer no longer replaces the latest search.
- The controls search also looks at the text shown on screen, the group and the internal name of each command.
- Controls: choose your keyboard (AZERTY, QWERTY, QWERTZ) and its format (ISO with the L-shaped Enter and the extra key next to left Shift, or ANSI). By default EDCH follows the layout written in the bindings file.

## 0.9.8

- Click the EDCH logo to fold the side menu away (and click it again to bring it back). It stays folded at the next start.
- Full screen button in the top bar: only the current page, without the menu and the top bar. Esc (or the "Exit full screen" button) brings everything back; F11 also toggles it.
- "Open this page alone in the browser" button, for a second screen. It appears while the remote access server is on, since that server serves the page.
- "Mobile access" is now called "Remote access": it serves the phone, a tablet, or any browser.
- New option in Settings → Game and search: from the phone, also copy to the phone's clipboard. The PC's clipboard always gets it.

## 0.9.7

- On the phone, copying (a system name, for example) no longer touches the phone's clipboard: the text only goes to the clipboard of the PC running EDCH, where the game is.

## 0.9.6

- Settings are split into tabs: General, Game and search, Display, Notifications, Advanced. The last tab opened is remembered.
- Every notification option is now in Settings → Notifications: sound and colour, the tab, wing notifications (new mission, acceptance, everyone accepted, a member leaving) and the mining alert. The Missions and Mining pages link there.

## 0.9.5

- Notifications settings moved to Settings. The side tab is now called "Notifications" and gathers every notification: wing, mining, available updates, start-up problems… The latest come first, then the missions overview.
- "Hide the tab" really hides it now (it kept showing). The sound still plays if it's ticked.
- The phone can change the notification settings too.

## 0.9.4

- Inara has approved EDCH: Inara sync works, and the "in development" notice on the Synchronisation page is gone.
- Mining (prospecting and Merit Miner): "where to mine" comes first, in green, then "where to sell", in blue. Each hotspot shows the planet (a link to its Spansh page), the ring, the ring type, its reserve, the number of hotspots and the distance from arrival.
- Mining: each mineral shows how it's mined (laser, subsurface with displacement missiles, core with seismic charges).
- Mining: when nothing is found within the search radius, EDCH widens it (up to 2,000 ly) and says so; if there's still nothing, it says you'll have to go further, with a fleet carrier for example.
- Prospecting tab: a "Where to mine" finder for any mineral, nearest hotspots first, with the best places to sell it.

## 0.9.3

- Top bar: EDCH shows whether Elite Dangerous (or its launcher) is running, and a "Launch Elite" button starts it through Steam, Epic Games or a launcher of your choice (Frontier's, MinEdLauncher…), set in Settings. It works from the phone too.
- What's new is shown after an update (can be turned off in Settings), and from About or Settings at any time.
- Settings → Pages and display: hide the pages you don't use from the menu, pick the start page and the interface size. It applies on the phone as well, and can be changed from either.
- Settings → Application: what the window's close button does: quit, minimise to the taskbar, hide in the notification area (EDCH keeps running), or ask before quitting.
- EDCH only runs once: launching it again brings the open window to the front.

## 0.9.2

- The window reopens where you left it: position, size, maximised or full screen.
- Problems found at start-up are shown in a red banner, like the update offer: game journal missing or unreadable, mobile access port unavailable, journal history unreadable, wing connection failing, an upload refused by EDDN or EDSM, or an unexpected error. Each has a button to the right page and one to open the logs.
- Settings: "Updates" moved up, right after the language.

## 0.9.1

- Linux: each release now also has an AppImage, a .deb, an .rpm, a PKGBUILD for Arch Linux and an experimental Flatpak. EDCH finds the game's journal and options in Steam's Proton folder (native, Flatpak or Snap Steam, any Steam library). On Linux, updates open the release page.
- Colonisation: a fleet carrier's market now comes first from your own journal: Market.json is read as soon as you open the carrier's market, and every purchase or sale there updates it at once. Spansh is only asked when your own data is more than 5 minutes old, and only used if it is newer.
- Debug log: docking, market, trades at a carrier, transfers and carrier stats are logged with their details.

## 0.9.0

- Exploration → Cartography: what EDSM knows about the system you're in: bodies already reported (and how many were never sent), who discovered the main star, the estimated value with and without mapping, and the most valuable bodies. A system EDSM has never seen is flagged: you may be the first.
- About: a "Report a bug" section with the steps (debug mode, logs folder, GitHub issue pre-filled with your version) and exactly what a log contains and never contains.
- Logs are cleaned automatically, on every line and in every file: no Windows user name or personal folder path, no full IP addresses, no Wi-Fi name, no pairing or wing codes, no long tokens or Frontier ids. API keys and typed text were already never written.
- Colonisation and Synchronisation say they're still in development, like Missions (carrier holds are estimates until the Frontier API connection; Inara hasn't approved EDCH yet).

## 0.8.9

- Colonisation: each carrier (yours and your squadron's) also shows its market as Spansh last saw it, what it sells with its stock and what it buys, with the data's age. EDCH checks again every 5 minutes while the page is open. The "Carriers" column uses the higher of the journal estimate and the stock on sale.
- Inara doesn't let apps read a carrier's hold, so it can't be used for this; the only complete source would be Frontier's own API (Frontier account login), which EDCH doesn't use yet.

## 0.8.8

- Wing: when a member closes EDCH, their EDCH tells the others on its way out (an encrypted "leaving" message prepared in advance, sent even as the window closes). Leaving the wing in game does the same, and EDCH shares again when you join a wing.
- Wing: a notification says when a member closed EDCH, left the wing in game or stopped sharing (can be turned off). Members who left stay shown, greyed out with the reason, for 10 minutes.
- Wing: a member who sends nothing for 45 minutes (crash, PC asleep) is now considered gone, instead of after 2 hours.

## 0.8.7

- Colonisation: the ship's hold is always up to date (EDCH now reads Cargo.json, which the game rewrites after every purchase, sale or delivery; the journal often only gives the total).
- Colonisation: a "Holds" panel shows the ship's hold, your fleet carrier's and your squadron carrier's, side by side, with the goods your construction sites need highlighted, and a "Carriers" column in each site's table.
- A carrier's hold is rebuilt from the journal (ship ↔ carrier transfers, tritium deposited as fuel, purchases and sales on its market), as the game never lists it. Your carrier's total comes from the carrier management screen; what can't be identified is shown as such.

## 0.8.6

- Mobile access: the "PC address" list shows the PC's connections a phone can use, Ethernet, Wi-Fi, Tailscale and VPNs, with the network's name ("Wi-Fi (ASUS)"), and the QR code and the link follow the one you pick. Hyper-V, WSL and other virtual adapters are left out. The Tailscale checkbox is gone: pick the Tailscale address in the list. The "away from home" section moved to the bottom of the page.

- Clickable references: a module name (engineers' specialities, materials' "used in" list, wishlist) opens Engineering on that module; a commodity (missions, recipes) opens the search for where to buy it; a system name is copied, and opens Navigation with it as destination when "Clicking a system also opens Navigation" is ticked in Settings.
- A system clicked on the phone is also copied to the PC's clipboard, ready to paste in the galaxy map.

## 0.8.5

- Turning the local server (mobile access) off and on again no longer fails with "port 47800 unavailable (os error 10048)": the port is now really released when the server stops.
- Error log: warnings and errors also go to a separate `edch-error_….log`, next to the standard log, created only when something goes wrong. The debug log still contains everything.
- Debug log: every action is logged (clicks, settings changed, pages opened), every call to the app's backend with its duration, and phone requests. Errors shown on screen (red lines, red notices, toasts) are logged too. API keys and typed text are never logged.
- Standard log: also records notifications, wing link start/stop, journal archive reading and actions coming from the phone.

## 0.8.4

- Wing missions are linked by their mission id, which is the same for the commander who shares and the one who accepts. Matching on faction, destination and expiry is only a fallback now.
- Accepting a shared mission writes nothing to the journal: EDCH now adds it to your missions as soon as the game sends a cargo depot update for it, completed with what the sharer's EDCH published (title, faction, destination, reward, expiry).
- Delivery and collection wing missions show the wing's progress ("384 / 784 delivered"), updated each time a member with EDCH delivers.
- Wing messages arrive within a second or two: EDCH keeps a live connection to ntfy.sh instead of checking every 15 seconds, and sends changes after 1 second instead of 3.
- Debug log: mission, cargo depot and wing events are logged with their details (mission id, type, progress, members).

## 0.8.3

- The side menu scrolls when the window is too short, so the last pages (About, Settings) are always reachable.
- Notices look the same everywhere: informative ones follow the theme colour, important warnings are red.
- Fixed a blank page when EDCH started on the Missions page.
- The top bar follows the colour theme and OLED mode.

## 0.8.2

- Application logs: EDCH always writes a standard log (one file per start). Logs older than a week are deleted automatically, the last 5 are always kept.
- Settings → Application logs: a debug mode writes a separate, detailed log (it also contains the standard lines), and a button opens the logs folder. API keys are never written to the logs.
- Portable version (`-portable.exe`): no installation needed. It doesn't install updates; when a new version is out, it opens the release page.

## 0.8.1

- The Missions page says it's still in development: the game writes nothing to the journal when a wing mission is shared or received, so tracking shared missions is approximate.
- Inara: while Inara hasn't approved EDCH, the sync log says so clearly and EDCH stops sending until the next start, instead of repeating the error.

## 0.8.0

- The current ship is detected as soon as you change it (shipyard swap, new ship, rename), instead of keeping the previous ship's name until a restart.
- Settings → Appearance: colour themes (Elite, Blue, Green, Purple, Red, High contrast), your own colours, a global OLED mode (pure black) and a button to restore the original colours. The phone follows the PC, and a change made on the phone is saved on the PC.
- Mobile access shows the link next to the QR code, with a copy button.
- Access away from home with Tailscale: EDCH detects it and can put its address in the QR code and the link. A step-by-step guide explains when it's useful (mobile data, public Wi-Fi, cloud gaming) and how to set it up. Remote access isn't EDCH's main purpose: Tailscale is the only option for now, while a built-in solution is developed.

## 0.7.3

- Search results show "You are here" on the system you're in, with how long ago your journal saw it, next to the date of Spansh's data.
- Each search has a "Refresh" button that skips the 10-minute cache.
- The Spansh date has a tooltip explaining where it comes from (data sent by players through EDDN).

## 0.7.2

- Game terms are shown as the game names them in your language (for example "High Grade Emissions" becomes "Émissions d'intensité élevée" in French), instead of English names or abbreviations such as HGE or USS.
- The update banner now shows what's new in the version.

## 0.7.1

- Wing missions are shared only when you choose: a button on each mission, or "share all my wing missions automatically".
- A wingmate's copy of a shared mission is recognised even with another id, another language and no wing flag; you're told when a member accepts a mission you share.
- Sourcing and mining missions: where to buy the goods (price, distance and freshness of the market data, estimated profit) and the nearest mining hotspots.

## 0.7.0

- New pages: Missions (with massacre stacks), shared wing missions with sound or colour notifications, Colonisation, Community goals, Exploration (exobiology and cartography), Mining (prospecting and Merit Miner), Powerplay and Session summary.
