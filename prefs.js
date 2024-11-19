import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AirRaidWidgetPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Получаем настройки расширения
        const settings = this.getSettings('org.gnome.shell.extensions.air-raid-widget');

        // Создаем страницу настроек
        const page = new Adw.PreferencesPage();
        window.add(page);

        // Создаем группу настроек для положения виджета
        const positionGroup = new Adw.PreferencesGroup({
            title: _('Widget Position Settings'),
        });
        page.add(positionGroup);

        // Ползунок для настройки позиции по X
        const positionXRow = new Adw.ActionRow({
            title: _('Widget Position X'),
            subtitle: _('Adjust the horizontal position of the widget'),
        });

        const positionXAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 1920,
            step_increment: 1,
            value: settings.get_int('position-x'),
        });

        const positionXScale = new Gtk.Scale({
            adjustment: positionXAdjustment,
        });

        positionXScale.set_draw_value(true);
        positionXScale.set_digits(0);
        positionXScale.connect('value-changed', (widget) => {
            const value = Math.round(widget.get_value());
            settings.set_int('position-x', value);
        });

        positionXRow.add_suffix(positionXScale);
        positionXRow.activatable_widget = positionXScale;

        positionGroup.add(positionXRow);

        // Ползунок для настройки позиции по Y
        const positionYRow = new Adw.ActionRow({
            title: _('Widget Position Y'),
            subtitle: _('Adjust the vertical position of the widget'),
        });

        const positionYAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 1080,
            step_increment: 1,
            value: settings.get_int('position-y'),
        });

        const positionYScale = new Gtk.Scale({
            adjustment: positionYAdjustment,
        });
        positionYScale.set_draw_value(true);

        positionYScale.set_digits(0);
        positionYScale.connect('value-changed', (widget) => {
            const value = Math.round(widget.get_value());
            settings.set_int('position-y', value);
        });

        positionYRow.add_suffix(positionYScale);
        positionYRow.activatable_widget = positionYScale;

        positionGroup.add(positionYRow);

        // Scale for the horizontal scale of the widget
        const scaleXRow = new Adw.ActionRow({
            title: _('Widget Scale X'),
            subtitle: _('Adjust the horizontal scale of the widget'),
        });

        const scaleXAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 1080,
            step_increment: 10,
            value: settings.get_int('scale-x'),
        });

        const scaleXScale = new Gtk.Scale({
            adjustment: scaleXAdjustment,
        });
        scaleXScale.set_digits(0);
        scaleXScale.set_draw_value(true);
        scaleXScale.connect('value-changed', (widget) => {
            const value = Math.round(widget.get_value());
            settings.set_int('scale-x', value);
        });

        scaleXRow.add_suffix(scaleXScale);
        scaleXRow.activatable_widget = scaleXScale;

        positionGroup.add(scaleXRow);

        // // Ползунок для настройки позиции по Y
        // const scaleYRow = new Adw.ActionRow({
        //     title: _('Widget Scale Y'),
        //     subtitle: _('Adjust the vertical scale of the widget'),
        // });
        //
        // const scaleYAdjustment = new Gtk.Adjustment({
        //     lower: 0,
        //     upper: 1920,
        //     step_increment: 10,
        //     value: settings.get_int('scale-y'),
        // });
        //
        // const scaleYScale = new Gtk.Scale({
        //     digits: 0,
        //     adjustment: scaleYAdjustment,
        //     show_fill_level: true,
        // });
        // scaleYScale.set_draw_value(true);
        //
        // scaleYScale.connect('value-changed', (widget) => {
        //     const value = Math.round(widget.get_value());
        //     settings.set_int('scale-y', value);
        // });
        //
        // scaleYRow.add_suffix(scaleYScale);
        // scaleYRow.activatable_widget = scaleYScale;

        // positionGroup.add(scaleYRow);

        // Создаем группу для выбора региона
        const regionGroup = new Adw.PreferencesGroup({
            title: _('Alert Notification Region'),
        });
        page.add(regionGroup);

        const regionRow = new Adw.ComboRow({
            title: _('Select Region for Alerts'),
            use_subtitle: true,
        });

        const regions = [
            '',
            'Вінницька область', 'Волинська область', 'Дніпропетровська область',
            'Донецька область', 'Житомирська область', 'Закарпатська область',
            'Запорізька область', 'Івано-Франківська область', 'Київська область',
            'Кіровоградська область', 'Луганська область', 'Львівська область',
            'Миколаївська область', 'Одеська область', 'Полтавська область',
            'Рівненська область', 'Сумська область', 'Тернопільська область',
            'Харківська область', 'Херсонська область', 'Хмельницька область',
            'Черкаська область', 'Чернівецька область', 'Чернігівська область',
            'м. Київ'
        ];

        regionRow.model = new Gtk.StringList({ strings: regions });
        regionRow.selected = regions.indexOf(settings.get_string('selected-region'));
        regionRow.connect('notify::selected', () => {
            settings.set_string('selected-region', regions[regionRow.selected]);
        });

        regionGroup.add(regionRow);
    }
}
