# Calendar Planner Card

Eigen Lovelace-kaart: gezinsagenda + taken in één tijdlijn, met beheer (afvinken/toevoegen/verwijderen), maandweergave en "Zonder datum"-sectie.

## Installatie

HACS → Aangepaste repositories → guntherper/ha-calendar-planner-card (categorie: Plugin)

## Config

```yaml
type: custom:calendar-planner-card
title: Planner
calendars:
  - calendar.gezin_2
  - calendar.jarvisub69_gmail_com
todos:
  - todo.gezin_actief
  - todo.gezin
days: 14
```
