import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import Clutter from 'gi://Clutter';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

// URL API and widget params
const api = 'https://ubilling.net.ua/aerialalerts/';
const interval = 20 * 1000;

let map;

export default class AirRaidWidgetExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._box = null;
        this._icon = null;
        this._timer = null;
        this._button = null;
        this._alertRegions = [];
        this._previousAlertRegions = [];
        this._session = new Soup.Session();
        this._mapVisible = false;
        this._alertRegionsMenuItems = [];
        this._alertSeparator = null;
        this._mapMenuImage = null; // Map image container in the menu
        this._settings = this.getSettings('org.gnome.shell.extensions.air-raid-widget');
    }

    svg2Gicon(svg) {
        const byteArray = new TextEncoder().encode(svg);;
        const gbytes = GLib.Bytes.new(byteArray);
        return new Gio.BytesIcon({ bytes: gbytes });
    }

    changeColor(xml, region, color) {
        const regionName = this.escapeRegExp(region.trim());
        const replace = `(name="${regionName}" fill=".*?")|(name="${regionName}")`;
        const re = new RegExp(replace, "g");
        return xml.replace(re, `name="${regionName}" fill="${color}"`);
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    noDataMap(map) {
        const replace = `(?:name="(.*?)" fill=".*?")|(?:name="(.*?)")`;
        const re = new RegExp(replace, "g");
        return map.replace(re, `name="$1$2" fill="#118AB2"`);
    }

    updateRegions(map, data) {
        let current_state_map = map;
        this._alertRegions = [];

        Object.entries(data.states).forEach(([region, details]) => {
            if (details.alertnow) {
                current_state_map = this.changeColor(current_state_map, region, '#EF476F');
                this._alertRegions.push(`${region}`);
            } else {
                current_state_map = this.changeColor(current_state_map, region, '#06D6A0');
            }
        });

        return current_state_map;
    }

    createBox() {
        const width = this._settings.get_int('scale-x');
        const height = width / 1.5;

        this._icon = new St.Icon({
            gicon: this.svg2Gicon(this.noDataMap(map)),
            icon_size: width,
            width: width,
            height: height,
        });

        let propBox = new St.BoxLayout({
            reactive: true,
            can_focus: true,
            track_hover: true,
            width: width,
            height: height,
        });

        propBox.opacity = 255;
        propBox.set_size(width, height);

        let x = this._settings.get_int('position-x') || 80;
        let y = this._settings.get_int('position-y') || 40;
        propBox.set_position(x, y);

        propBox.add_child(this._icon);

        propBox.connect('button-press-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this._dragging = true;
                let [stageX, stageY] = event.get_coords();
                this._dragOffsetX = stageX - actor.x;
                this._dragOffsetY = stageY - actor.y;
            }
        });

        propBox.connect('motion-event', (actor, event) => {
            if (this._dragging) {
                let [stageX, stageY] = event.get_coords();
                let newX = stageX - this._dragOffsetX;
                let newY = stageY - this._dragOffsetY;

                actor.set_position(newX, newY);
            }
        });

        propBox.connect('button-release-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this._dragging = false;

                const newX = actor.x;
                const newY = actor.y;

                this._settings.set_int('position-x', newX);
                this._settings.set_int('position-y', newY);

                this.updateMapSize();
            }
        });

        return propBox;
    }

    updateMapSize() {
        let x = this._settings.get_int('position-x');
        let y = this._settings.get_int('position-y');

        if (x === 0) x = 80;
        if (y === 0) y = 40;

        if (this._box) {
            this._box.set_position(x, y);
        }

        const mapWidth = this._settings.get_int('scale-x');
        const mapHeight = mapWidth / 1.5;

        if (this._icon) {
            this._icon.set_width(mapWidth);
            this._icon.set_height(mapHeight);
            this._box.set_size(mapWidth, mapHeight);
        }
    }

    updateWidget() {
        const uri = GLib.Uri.parse(api, GLib.UriFlags.NONE);
        const message = new Soup.Message({
            method: 'GET',
            uri: uri,
        });

        this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, res) => {
            try {
                const response_bytes = this._session.send_and_read_finish(res);
                const response_text = new TextDecoder().decode(response_bytes.get_data());

                const obj = JSON.parse(response_text);

                // Check if there's any change in regions
                const newAlertRegions = Object.entries(obj.states)
                    .filter(([region, details]) => details.alertnow)
                    .map(([region]) => region);

                if (this.haveRegionsChanged(newAlertRegions)) {
                    this._alertRegions = newAlertRegions;
                    this._icon.set_gicon(this.svg2Gicon(this.updateRegions(map, obj)));
                    this.updateMenuItems();
                }

                this.checkForNewAlerts();

            } catch (e) {
                this._icon.set_gicon(this.svg2Gicon(this.noDataMap(map)));
            }
        });
    }

    haveRegionsChanged(newAlertRegions) {
        if (this._previousAlertRegions.length !== newAlertRegions.length) {
            return true;
        }

        for (let region of newAlertRegions) {
            if (!this._previousAlertRegions.includes(region)) {
                return true;
            }
        }

        return false;
    }

    updateMenuItems() {
        this._alertRegionsMenuItems.forEach(item => {
            item.destroy();
        });
        this._alertRegionsMenuItems = [];

        if (this._alertSeparator) {
            this._alertSeparator.destroy();
            this._alertSeparator = null;
        }

        this._alertSeparator = new PopupMenu.PopupSeparatorMenuItem();
        this._button.menu.addMenuItem(this._alertSeparator);

        if (this._alertRegions.length > 0) {
            this._alertRegions.forEach(region => {
                const menuItem = new PopupMenu.PopupMenuItem(region);
                this._button.menu.addMenuItem(menuItem);
                this._alertRegionsMenuItems.push(menuItem);
            });
        } else {
            const noAlertItem = new PopupMenu.PopupMenuItem(_('No active alerts'));
            this._button.menu.addMenuItem(noAlertItem);
            this._alertRegionsMenuItems.push(noAlertItem);
        }
    }

    checkForNewAlerts() {
        const selectedRegion = this._settings.get_string('selected-region');

        const newAlerts = this._alertRegions.filter(region => {
            const isSelected = selectedRegion === '' || selectedRegion === region;
            return isSelected && !this._previousAlertRegions.includes(region);
        });

        if (newAlerts.length > 0) {
            this.showAlertNotification(newAlerts);
        }

        this._previousAlertRegions = [...this._alertRegions];
    }

    showAlertNotification(newAlerts) {
        const notificationTitle = _('New Air Raid Alert!');
        const notificationBody = _('Regions with new alerts: ') + newAlerts.join(', ');

        Main.notify(notificationTitle, notificationBody);
    }

    toggleMapVisibility(state) {
        this._mapVisible = state;

        this._settings.set_boolean('show-map', this._mapVisible);

        if (this._mapVisible) {
            Main.layoutManager.addTopChrome(this._box);
        } else {
            Main.layoutManager.removeChrome(this._box);
        }
    }

    enable() {
        const file = Gio.File.new_for_path(this.dir.get_child('ua.svg').get_path());
        const [, contents] = file.load_contents(null);
        map = new TextDecoder().decode(contents);

        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            this.updateWidget();
            return GLib.SOURCE_CONTINUE;
        });

        this._settings = this.getSettings('org.gnome.shell.extensions.air-raid-widget');
        this._mapVisible = this._settings.get_boolean('show-map');

        this._box = this.createBox();

        this.updateWidget();

        if (this._mapVisible) {
            Main.layoutManager.addTopChrome(this._box);
        }

        this._button = new PanelMenu.Button(0.0, 'Air Raid Alerts', false);
        const icon = new St.Icon({ icon_name: 'weather-storm-symbolic', style_class: 'system-status-icon' });
        this._button.add_child(icon);

        this._mapSwitch = new PopupMenu.PopupSwitchMenuItem(_('Show Map'), this._mapVisible);
        this._mapSwitch.connect('toggled', (item, state) => {
            this.toggleMapVisibility(state);
        });
        this._button.menu.addMenuItem(this._mapSwitch);

        this._button.menu.addAction(_('Preferences'), () => this.openPreferences());

        this.updateMenuItems();

        Main.panel.addToStatusArea('air-raid-button', this._button);

        this._settings.connect('changed::position-x', () => {
            this.updateMapSize();
        });
        this._settings.connect('changed::position-y', () => {
            this.updateMapSize();
        });
        this._settings.connect('changed::scale-x', () => {
            this.updateMapSize();
        });
    }

    disable() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = null;
        }
        if (this._box) {
            Main.layoutManager.removeChrome(this._box);
            this._box = null;
        }

        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
    }
}
