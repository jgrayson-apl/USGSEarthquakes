/*
 | Copyright 2016 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
define([
  "boilerplate/ItemHelper",
  "boilerplate/UrlParamHelper",
  "dojo/i18n!./nls/resources",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/_base/Color",
  "dojo/colors",
  "dojo/number",
  "dojo/date",
  "dojo/date/locale",
  "dojo/date/stamp",
  "dojo/on",
  "dojo/aspect",
  "dojo/mouse",
  "dojo/query",
  "dojo/dom",
  "dojo/dom-attr",
  "dojo/dom-class",
  "dojo/dom-geometry",
  "dojo/dom-construct",
  "dojo/Deferred",
  "dojo/promise/all",
  "dojox/gfx",
  "dijit/registry",
  "esri/config",
  "esri/core/watchUtils",
  "esri/widgets/Search",
  "esri/widgets/Legend",
  "esri/layers/Layer",
  "esri/layers/CSVLayer",
  "esri/layers/FeatureLayer",
  "esri/layers/support/Field",
  "esri/tasks/support/Query",
  "esri/PopupTemplate",
  "esri/renderers/SimpleRenderer",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/symbols/SimpleLineSymbol",
  "esri/layers/support/LabelClass",
  "esri/symbols/LabelSymbol3D",
  "esri/symbols/TextSymbol3DLayer",
  "esri/identity/IdentityManager",
  "widgets/ViewPlayback"
], function (ItemHelper, UrlParamHelper, i18n, declare, lang, array, Color, colors, number, date, locale, stamp,
             on, aspect, mouse, query, dom, domAttr, domClass, domGeom, domConstruct, Deferred, all, gfx, registry,
             esriConfig, watchUtils, Search, Legend,
             Layer, CSVLayer, FeatureLayer, Field, Query, PopupTemplate,
             SimpleRenderer, SimpleMarkerSymbol, SimpleLineSymbol, LabelClass, LabelSymbol3D, TextSymbol3DLayer,
             IdentityManager, ViewPlayback) {

  var CSS = {
    loading: "boilerplate--loading",
    error: "boilerplate--error",
    errorIcon: "esri-icon-notice-round"
  };

  return declare(null, {

    constructor: function () {
    },

    config: null,

    direction: null,


    init: function (boilerplateResponse) {
      if(boilerplateResponse) {
        this.direction = boilerplateResponse.direction;
        this.config = boilerplateResponse.config;
        this.settings = boilerplateResponse.settings;
        var boilerplateResults = boilerplateResponse.results;
        var webMapItem = boilerplateResults.webMapItem;
        var webSceneItem = boilerplateResults.webSceneItem;
        var groupData = boilerplateResults.group;

        document.documentElement.lang = boilerplateResponse.locale;

        this.urlParamHelper = new UrlParamHelper();
        this.itemHelper = new ItemHelper();

        this._setDirection();

        if(webMapItem) {
          this._createWebMap(webMapItem);
        }
        else if(webSceneItem) {
          this._createWebScene(webSceneItem);
        }
        else if(groupData) {
          this._createGroupGallery(groupData);
        }
        else {
          this.reportError(new Error("app:: Could not load an item to display"));
        }
      }
      else {
        this.reportError(new Error("app:: Boilerplate is not defined"));
      }
    },

    reportError: function (error) {
      // remove loading class from body
      domClass.remove(document.body, CSS.loading);
      domClass.add(document.body, CSS.error);
      // an error occurred - notify the user. In this example we pull the string from the
      // resource.js file located in the nls folder because we've set the application up
      // for localization. If you don't need to support multiple languages you can hardcode the
      // strings here and comment out the call in index.html to get the localization strings.
      // set message
      var node = dom.byId("loading_message");
      if(node) {
        node.innerHTML = "<h1><span class=\"" + CSS.errorIcon + "\"></span> " + i18n.error + "</h1><p>" + error.message + "</p>";
      }
      return error;
    },

    //--------------------------------------------------------------------------
    //
    //  Private Methods
    //
    //--------------------------------------------------------------------------

    _setDirection: function () {
      var direction = this.direction;
      var dirNode = document.getElementsByTagName("html")[0];
      domAttr.set(dirNode, "dir", direction);
    },

    _createWebMap: function (webMapItem) {
      this.itemHelper.createWebMap(webMapItem).then(function (map) {

        var viewProperties = {
          map: map,
          container: this.settings.webmap.containerId
        };

        if(!this.config.title && map.portalItem && map.portalItem.title) {
          this.config.title = map.portalItem.title;
        }
        lang.mixin(viewProperties, this.urlParamHelper.getViewProperties(this.config));

        require(["esri/views/MapView"], function (MapView) {

          var view = new MapView(viewProperties);
          view.then(function (response) {
            this.urlParamHelper.addToView(view, this.config);
            this._ready(view);
          }.bind(this), this.reportError);

        }.bind(this));

      }.bind(this), this.reportError);
    },

    _createWebScene: function (webSceneItem) {
      this.itemHelper.createWebScene(webSceneItem).then(function (map) {

        var viewProperties = {
          map: map,
          container: this.settings.webscene.containerId
        };

        if(!this.config.title && map.portalItem && map.portalItem.title) {
          this.config.title = map.portalItem.title;
        }
        lang.mixin(viewProperties, this.urlParamHelper.getViewProperties(this.config));

        require(["esri/views/SceneView"], function (SceneView) {

          var view = new SceneView(viewProperties);
          view.then(function (response) {

            this.urlParamHelper.addToView(view, this.config);
            this._ready(view);

          }.bind(this), this.reportError);

        }.bind(this));

      }.bind(this), this.reportError);
    },

    _createGroupGallery: function (groupData) {
      var groupInfoData = groupData.infoData;
      var groupItemsData = groupData.itemsData;

      if(!groupInfoData || !groupItemsData || groupInfoData.total === 0 || groupInfoData instanceof Error) {
        this.reportError(new Error("app:: group data does not exist."));
        return;
      }

      var info = groupInfoData.results[0];
      var items = groupItemsData.results;

      this._ready();

      if(info && items) {
        var html = "";

        html += "<h1>" + info.title + "</h1>";

        html += "<ol>";

        items.forEach(function (item) {
          html += "<li>" + item.title + "</li>";
        });

        html += "</ol>";

        document.body.innerHTML = html;
      }

    },

    _ready: function (view) {
      domClass.remove(document.body, CSS.loading);

      // VIEW CENTER //
      view.center = [-150.0, 20.0];

      // TITLE //
      document.title = this.config.title;
      var titleNode = domConstruct.create("div", { className: "app-title-node", innerHTML: this.config.title });
      view.ui.add(titleNode, { position: "top-left", index: 0 });

      // SEARCH //
      var searchWidget = new Search({ view: view });
      view.ui.add(searchWidget, { position: "top-left", index: 1 });

      // LEGEND PARENT NODE //
      var legendParentNode = domConstruct.create("div", { className: "legend-parent collapsed" });
      view.ui.add(legendParentNode, "bottom-left");
      var legendLabelNode = domConstruct.create("div", { className: "legend-label" }, legendParentNode);
      domConstruct.create("span", { innerHTML: "Legend" }, legendLabelNode);
      var legendToggleNode = domConstruct.create("span", { className: "legend-toggle esri-icon-arrow-up-circled" }, legendLabelNode);
      on(legendToggleNode, "click", function (evt) {
        domClass.toggle(legendToggleNode, "esri-icon-arrow-up-circled");
        domClass.toggle(legendToggleNode, "esri-icon-arrow-down-circled");
        domClass.toggle(legendParentNode, "collapsed");
      }.bind(this));
      var legendContentNode = domConstruct.create("div", { className: "legend-content" }, legendParentNode);
      // LEGEND //
      var legend = new Legend({ view: view, container: legendContentNode });


      // POPUP DOCKING OPTIONS //
      view.popup.dockEnabled = true;
      view.popup.dockOptions = {
        buttonEnabled: false,
        breakpoint: false,
        position: "top-center"
      };

      this.getStartOfDayUTC = function (date) {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
      };

      // ...DATE TIME RANGE STUFF... //
      var startOfTodayUTC = this.getStartOfDayUTC(new Date());
      // DAYS OF THE WEEK //
      var thisWeek = [
        date.add(startOfTodayUTC, "day", -6),
        date.add(startOfTodayUTC, "day", -5),
        date.add(startOfTodayUTC, "day", -4),
        date.add(startOfTodayUTC, "day", -3),
        date.add(startOfTodayUTC, "day", -2),
        date.add(startOfTodayUTC, "day", -1),
        startOfTodayUTC
      ];

      this.currentFilter = {
        maxMag: 10.0,
        range: [thisWeek[0], thisWeek[1]],
        isDayUpdate: true
      };
      this.updateFilter = function (updates) {
        lang.mixin(this.currentFilter, updates);
      }.bind(this);


      this.fixISODate = function (isoDateString) {
        // MAP SERVICE WANTS THE ISO DATE WITHOUT THE TIME AND ZULU DESIGNATORS //
        return isoDateString.replace(/T/, " ").replace(/Z/, "");
      };

      this.formatISODatesForQuery = function (date1, date2, maxMag) {
        return lang.replace("(mag > 0.0 AND mag <= {maxMag}) AND (eventTime BETWEEN timestamp '{startUTC}' AND timestamp '{endUTC}')", {
          maxMag: Number(maxMag || 10.0).toFixed(1),
          startUTC: this.fixISODate(stamp.toISOString(date1, { zulu: true })),
          endUTC: this.fixISODate(stamp.toISOString(date2, { zulu: true }))
        });
      };


      // http://www.arcgis.com/home/item.html?id=af7568d8579048f7b42e534891824029
      // http://apl.maps.arcgis.com/home/item.html?id=fa8e34b9d4514903a3ac34323780fb32#data
      var usgsEarthquakeDataUrl = "https://livefeeds.arcgis.com/arcgis/rest/services/LiveFeeds/USGS_Seismic_Data/MapServer";

      /*

       "id":"ak15060364"
       "mag":1.4
       "sig":30
       "alert":null
       "place":"23km NNE of Badger, Alaska"
       "hoursOld":163
       "updated":1484094438000,
       "tz":-540,
       "url":"http://earthquake.usgs.gov/earthquakes/eventpage/ak15060364#pager",
       "detail":"http://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/ak15060364.geojson"
       "felt":null
       "cdi":null
       "mmi":null
       "status":"Automatic"
       "tsunami":null
       "net":"ak"
       "code":"15060364"
       "ids":"ak15060364"
       "sources":"ak"
       "types":"geoserve,origin"
       "nst":null
       "dmin":null
       "rms":0.8
       "gap":null
       "magType":"Ml"
       "longitude":-147.2877
       "latitude":64.9882
       "depth":3.1
       "eventType":"earthquake"
       "eventTime":1484093385000
       */

      // "Event Time: <strong>{eventTime:DateString}</strong><br>Magnitude: <strong>{mag:NumberFormat(places:2)}</strong><br>Depth: <strong>{depth:NumberFormat(places:2)}</strong>"
      function earthquakePopupContent(evt) {
        var atts = evt.graphic.attributes;

        var earthquakeNode = domConstruct.create("div");

        var eventTime = new Date(atts.eventTime);
        var localTime = date.add(eventTime, "minute", atts.tz);

        //var localTimeStr = locale.format(new Date(localTime), { selector: "time", timePattern: "h:mm:ss a" });
        //var UTC = new Date(Date.UTC(eventTime.getUTCFullYear(), eventTime.getUTCMonth(), eventTime.getUTCDate(), 0, 0, 0, 0));
        //var localTimeUTC = (new Date(eventTime)).setUTCMinutes(eventTime);

        domConstruct.create("div", {
          innerHTML: lang.replace("Event Time: <strong>{value}</strong>", {
            value: locale.format(new Date(eventTime), { selector: "time", timePattern: "hh:mm:ss a" })
          })
        }, earthquakeNode);

        domConstruct.create("div", {
          innerHTML: lang.replace("Local Time: <strong>{value}</strong>", {
            value: locale.format(new Date(localTime), { selector: "time", timePattern: "hh:mm:ss a" })
          })
        }, earthquakeNode);

        domConstruct.create("div", {
          innerHTML: lang.replace("Magnitude: <strong>{value}</strong>", {
            value: number.format(atts.mag, { places: 2 })
          })
        }, earthquakeNode);

        domConstruct.create("div", {
          innerHTML: lang.replace("Depth: <strong>{value}</strong>", {
            value: number.format(atts.depth, { places: 2 })
          })
        }, earthquakeNode);

        domConstruct.create("a", {
          href: atts.url.replace(/#pager/, "#executive"),
          target: "_blank",
          innerHTML: "View full details from USGS"
        }, earthquakeNode);

        return earthquakeNode;
      }


      // EARTHQUAKES LAYER //
      this.earthquakesLayer = new FeatureLayer({
        url: usgsEarthquakeDataUrl,
        layerId: 11,
        title: "USGS Earthquakes",
        copyright: "USGS",
        outFields: ["*"],
        opacity: 0.8,
        renderer: new SimpleRenderer({
          label: "Earthquake",
          symbol: new SimpleMarkerSymbol({
            color: Color.named.orange,
            outline: new SimpleLineSymbol({ color: Color.named.white.concat(0.9), width: 1.5 }),
            size: "11pt"
          }),
          visualVariables: [
            {
              type: "size",
              field: "mag",
              minDataValue: 1,
              maxDataValue: 7,
              minSize: 7,
              maxSize: 35
            },
            {
              type: "color",
              field: "mag",
              minDataValue: 1,
              maxDataValue: 7,
              stops: [
                { value: 1, color: Color.named.darkred },
                { value: 5, color: Color.named.darkorange },
                { value: 7, color: Color.named.orange }
              ]
            }//,
            /*{
             type: "opacity",
             field: "hoursOld",
             legendOptions: {
             title: "How Recent?"
             },
             stops: [
             { value: 140, opacity: 0.2, label: "a week ago" },
             { value: 24, opacity: 1.0, label: "today" }
             ]
             }*/
          ]
        }),
        labelsVisible: true,
        labelingInfo: [
          new LabelClass({
            labelExpressionInfo: {
              value: "{mag}"
            },
            where: "mag >= 5.0",
            labelPlacement: "above-center",
            symbol: new LabelSymbol3D({
              symbolLayers: [
                new TextSymbol3DLayer({
                  material: { color: Color.named.white },
                  size: 11,
                  font: { style: "normal", weight: "bold", family: "Avenir Next W00" }
                })
              ]
            })
          })
        ],
        popupTemplate: { title: "{place}", content: earthquakePopupContent }
      });
      this.earthquakesLayer.load().then(function () {
        console.info("LAYER: ", this.earthquakesLayer);

        // DATE RANGE LABEL NODE //
        var dateRangeLabelNode = domConstruct.create("div", { className: "date-range-label" });
        view.ui.add(dateRangeLabelNode, { position: "top-right", index: 0 });

        // FILTER BY DATE //
        this.filterEarthquakes = function () {
          view.popup.close();
          var toDate = date.add(this.currentFilter.range[1], "second", -1);
          this.earthquakesLayer.definitionExpression = this.formatISODatesForQuery(this.currentFilter.range[0], toDate, this.currentFilter.maxMag);
          dateRangeLabelNode.innerHTML = lang.replace("{0} to {1}", [this.currentFilter.range[0].toUTCString(), toDate.toUTCString()]);
          //dateRangeLabelNode.innerHTML = this.earthquakesLayer.definitionExpression;
        }.bind(this);

        // ADD EARTHQUAKE LAYER TO MAP //
        view.map.add(this.earthquakesLayer);

        //
        // USGS Earthquakes in the past week //
        //
        var dayOfWeekNode = registry.byId("options-top-pane").containerNode;
        domConstruct.create("div", { className: "options-label", innerHTML: "Earthquake Count By Day" }, dayOfWeekNode);
        var histogramNode = domConstruct.create("div", { className: "options-content-node" }, dayOfWeekNode);

        //
        // Earthquake Count By Hour of Day //
        //
        var byHourNode = registry.byId("options-center-pane").containerNode;
        var hourLabelNode = domConstruct.create("div", { className: "options-label", innerHTML: "Earthquake Count By Hour of Day" }, byHourNode);
        var clearHourNode = domConstruct.create("span", { className: "options-clear esri-icon-close", title: "Clear Hour Filter" }, hourLabelNode);
        on(clearHourNode, "click", function () {
          var startDate = this.getStartOfDayUTC(this.currentFilter.range[0]);
          this.updateFilter({
            maxMag: 10.0,
            range: [startDate, date.add(startDate, "day", 1)],
            isDayUpdate: true
          });
          this.filterEarthquakes();
        }.bind(this));
        // TOGGLE HOURS DISPLAY //
        var optionToggleNode = domConstruct.create("span", { className: "options-toggle esri-icon-refresh", title: "Toggle Single/Dual Clock Display" }, hourLabelNode);
        this.useSingleClock = true;
        on(optionToggleNode, "click", function () {
          this.useSingleClock = (!this.useSingleClock);
          this.updateDisplays();
        }.bind(this));

        // HOURS CONTENTS NODE //
        var byHourContentsNode = domConstruct.create("div", { id: "byHour-contents-node", className: "options-content-node" }, byHourNode);

        //
        // Earthquake Count By Magnitude //
        //
        var byMagnitudeNode = registry.byId("options-bottom-pane").containerNode;
        var magnitudeLabelNode = domConstruct.create("div", { className: "options-label", innerHTML: "Earthquake Count By Magnitude" }, byMagnitudeNode);
        var clearMagnitudeNode = domConstruct.create("span", { className: "options-clear esri-icon-close", title: "Clear Magnitude Filter" }, magnitudeLabelNode);
        on(clearMagnitudeNode, "click", function () {
          this.updateFilter({
            maxMag: 10.0,
            isDayUpdate: false
          });
          this.filterEarthquakes();
        }.bind(this));

        // MAGNITUDES CONTENTS NODE //
        var byMagnitudeContentsNode = domConstruct.create("div", { id: "byMagnitude-contents-node", className: "options-content-node" }, byMagnitudeNode);

        this.initializeHistogram(view, this.earthquakesLayer, thisWeek, histogramNode);
        this.monitorGraphicsChange(view, this.earthquakesLayer, byHourContentsNode, byMagnitudeContentsNode);

      }.bind(this));


    },

    initializeHistogram: function (view, featureLayer, thisWeek, histogramNode) {

      // MONTH NAMES //
      var monthNames = locale.getNames("months", "wide");

      // CREATE BIN FOR EACH DAY OF WEEK //
      var dateQueryHandles = thisWeek.map(function (dayOfThisWeek) {

        // CREATE AND ADJUST TO DATE //
        var toDate = date.add(dayOfThisWeek, "day", 1);
        toDate = date.add(toDate, "second", -1);

        // DAY OF WEEK QUERY //
        var dayOfThisWeekQuery = featureLayer.createQuery();
        dayOfThisWeekQuery.where = this.formatISODatesForQuery(dayOfThisWeek, toDate);
        dayOfThisWeekQuery.returnGeometry = false;
        //console.info(dayOfThisWeekQuery);

        // GET FEATURE COUNT FOR EACH BIN //
        return featureLayer.queryFeatureCount(dayOfThisWeekQuery).then(function (count) {
          return {
            dayOfThisWeek: dayOfThisWeek,
            count: count
          };
        }.bind(this), console.warn);

      }.bind(this));

      // BUILD HISTOGRAM ONCE ALL QUERIES HAVE RETURNED //
      all(dateQueryHandles).then(function (dateQueryInfos) {

        // GET TOTAL AND MAX //
        var totalBinCount = 0;
        var maxBinCount = -Infinity;
        array.forEach(dateQueryInfos, function (dateQueryInfo) {
          maxBinCount = Math.max(maxBinCount, dateQueryInfo.count);
          totalBinCount += dateQueryInfo.count;
        }.bind(this));

        // SET BAR WIDTH //
        var barMaxWidth = 300;
        var binNodes = array.map(dateQueryInfos, function (dateQueryInfo, dateQueryInfosIndex) {
          var count = dateQueryInfo.count;
          var dayOfThisWeek = dateQueryInfo.dayOfThisWeek;

          // BIN NODE //
          var binNode = domConstruct.create("div", { className: "histogram-bin" }, histogramNode);
          domClass.toggle(binNode, "bin-selected", (dateQueryInfosIndex === 0));

          // BIN LABEL = MONTH AND DATE //
          domConstruct.create("span", {
            innerHTML: lang.replace("{0} {1}", [monthNames[dayOfThisWeek.getUTCMonth()], dayOfThisWeek.getUTCDate()])
          }, domConstruct.create("span", { className: "histogram-label" }, binNode));

          if(count > 0) {

            // BAR NODE //
            domConstruct.create("span", {
              innerHTML: number.format(count),
              style: lang.replace("width:{0}px", [(barMaxWidth * (count / maxBinCount))])
            }, domConstruct.create("span", { className: "histogram-bar" }, binNode));

            // BIN SELECTED ON CLICK //
            on(binNode, "click", function (evt) {
              query(".histogram-bin").removeClass("bin-selected");
              domClass.add(binNode, "bin-selected");
              //this.updateEarthquakeDashboard(dateQueryInfo.features);
              this.updateFilter({
                range: [dayOfThisWeek, date.add(dayOfThisWeek, "day", 1)],
                isDayUpdate: true
              });
              this.filterEarthquakes();
              this.playback.setPlayIndex(dateQueryInfosIndex, false);
            }.bind(this));

          } else {
            domConstruct.create("span", { className: "histogram-bar-empty", innerHTML: "None" }, binNode);
          }

          return binNode;
        }.bind(this));

        // TOTALS NODE //
        domConstruct.create("div", {
          className: "histogram-total-label",
          innerHTML: lang.replace("Total Earthquakes: {total}", { total: number.format(totalBinCount) })
        }, histogramNode);


        // PLAYBACK NODE //
        var playbackNode = domConstruct.create("div", { className: "playback-parent-node" });
        view.ui.add(playbackNode, { position: "top-right", index: 1 });
        // PLAYBACK //
        this.playback = new ViewPlayback({
          view: view,
          playCount: 7,
          pauseDurationSeconds: 3,
          continueOnViewUpdate: false,
          loop: true
        }, playbackNode);
        // PLAYBACK UPDATE //
        this.playback.on("update", function (evt) {
          console.info("ViewPlayback.update: ", evt.playIndex, evt);
          binNodes[evt.playIndex].click();
        }.bind(this));
        this.playback.startup();


      }.bind(this), console.warn);


    },

    /*updateEarthquakeDashboard: function (features) {

     if(!this.currentHour) {

     // CRETE AGGREGATION OF MAGNITUDES AND HOURS OF DAY //
     var magnitudes = {};
     var hoursOfDay = {};
     features.forEach(function (graphic) {

     // CRETE AGGREGATION OF MAGNITUDES //
     var magnitude = +graphic.getAttribute("mag");
     var magnitudeIndex = Math.floor(magnitude);
     var magnitudeCount = magnitudes[magnitudeIndex];
     magnitudes[magnitudeIndex] = (magnitudeCount) ? (magnitudeCount + 1) : 1;

     // CRETE AGGREGATION OF HOURS OF DAY //
     var eventTime = new Date(graphic.getAttribute("eventTime"));
     var hourOfDayIndex = eventTime.getUTCHours();
     var hourOfDayCount = hoursOfDay[hourOfDayIndex];
     hoursOfDay[hourOfDayIndex] = (hourOfDayCount) ? (hourOfDayCount + 1) : 1;

     }.bind(this));

     this.updateDisplays = function () {
     var byHourContentsNode = dom.byId("byHour-contents-node");
     var byMagnitudeContentsNode = dom.byId("byMagnitude-contents-node");
     domConstruct.empty(byHourContentsNode);
     domConstruct.empty(byMagnitudeContentsNode);
     this.displayHoursOfDay(byHourContentsNode, hoursOfDay);
     this.displayMagnitudes(byMagnitudeContentsNode, magnitudes);
     }.bind(this);

     this.updateDisplays();
     aspect.after(registry.byId("options-pane"), "resize", this.updateDisplays, true);
     }

     },*/

    monitorGraphicsChange: function (view, sourceLayer, byHourContentsNode, byMagnitudeContentsNode) {

      view.whenLayerView(sourceLayer).then(function (layerView) {
        watchUtils.whenOnce(layerView, "controller").then(function (result) {
          var controller = result.value;

          var graphicsCollection = controller.graphics;
          graphicsCollection.on("change", function (evt) {
            console.info("CHANGE: ", graphicsCollection.length);

            if(this.currentFilter.isDayUpdate) {

              // CRETE AGGREGATION OF MAGNITUDES AND HOURS OF DAY //
              var magnitudes = {};
              var hoursOfDay = {};
              graphicsCollection.forEach(function (graphic, gIndex) {

                // CRETE AGGREGATION OF MAGNITUDES //
                var magnitude = +graphic.getAttribute("mag");
                var magnitudeIndex = Math.floor(magnitude);
                var magnitudeCount = magnitudes[magnitudeIndex];
                magnitudes[magnitudeIndex] = (magnitudeCount) ? (magnitudeCount + 1) : 1;

                // CRETE AGGREGATION OF HOURS OF DAY //
                var eventTime = new Date(graphic.getAttribute("eventTime"));
                var hourOfDayIndex = eventTime.getUTCHours();
                var hourOfDayCount = hoursOfDay[hourOfDayIndex];
                hoursOfDay[hourOfDayIndex] = (hourOfDayCount) ? (hourOfDayCount + 1) : 1;

              }.bind(this));

              // UPDATE DISPLAYS //
              this.updateDisplays = function () {
                domConstruct.empty(byHourContentsNode);
                domConstruct.empty(byMagnitudeContentsNode);
                this.displayHoursOfDay(byHourContentsNode, hoursOfDay);
                this.displayMagnitudes(byMagnitudeContentsNode, magnitudes);
              }.bind(this);

              // UPDATE DISPLAYS //
              this.updateDisplays();

              // UPDATE DISPLAYS WHEN CONTENT PANE IS RESIZED //
              aspect.after(registry.byId("options-pane"), "resize", this.updateDisplays, true);
            }
          }.bind(this));
        }.bind(this));
      }.bind(this));

    },


    /**
     * Ideas from here: http://dougmccune.com/blog/2011/04/21/visualizing-cyclical-time-hour-of-day-charts/
     * @param parentNode
     * @param hoursOfDay
     */
    displayHoursOfDay: function (parentNode, hoursOfDay) {

      if(this.useSingleClock) {
        var hoursOfDayNode = domConstruct.create("div", { className: "days-hours-chart-node" }, parentNode);
        var hoursBins = this.createDaysHoursChart(hoursOfDayNode, hoursOfDay);
        this.createHourEvents(hoursBins);
      } else {
        var dayHoursNode = domConstruct.create("span", { className: "hours-chart-node" }, parentNode);
        var nightHoursNode = domConstruct.create("span", { className: "hours-chart-node" }, parentNode);
        var amHourBins = this.createHoursSurface(dayHoursNode, "AM", hoursOfDay, 0, 11);
        var pmHourBins = this.createHoursSurface(nightHoursNode, "PM", hoursOfDay, 12, 23);
        this.createHourEvents(amHourBins.concat(pmHourBins));
      }

    },

    createDaysHoursChart: function (parentNode, hoursOfDay) {

      // NODE DIMENSIONS //
      var nodeBox = domGeom.getContentBox(parentNode);
      var nodeCenter = { x: nodeBox.w * 0.4, y: nodeBox.h * 0.5 };
      var outerRadius = (nodeBox.h * 0.33);

      var circleOutlineColor = "#ec5e2d";
      var circleFillColor = "rgba(36, 36, 36, 0.7)";
      var centerColor = "#ccc";
      var hourColor = "#ccc";

      // SURFACE //
      var surface = gfx.createSurface(parentNode, nodeBox.w, nodeBox.h);

      // OUTER CIRCLE //
      surface.createCircle({
        cx: nodeCenter.x,
        cy: nodeCenter.y,
        r: outerRadius
      }).setStroke({ color: "#333", style: "solid", width: 16.0 });

      // CENTER LABEL //
      surface.createText({
        x: nodeCenter.x,
        y: nodeCenter.y + 5.5,
        align: "middle",
        text: "AM"
      }).setFont({ family: "Avenir Next W00", size: "11pt" }).setFill(centerColor);

      surface.createText({
        x: nodeCenter.x + (outerRadius * 2.0),
        y: nodeCenter.y + 5.5,
        align: "middle",
        text: "PM"
      }).setFont({ family: "Avenir Next W00", size: "11pt" }).setFill(centerColor);


      var hourBins = [];

      // CREATE BIN FOR EACH HOUR //
      for (var hour = 0; hour <= 24; hour++) {
        var hourIndex = (hour > 12) ? (hour - 12) : hour;
        var azimuth = (hourIndex * 30.0);
        var isAM = (hour < 12);

        if(isAM) {
          // HOUR LABEL //
          var hourPnt = this._pointTo(nodeCenter, outerRadius, azimuth);
          surface.createText({
            x: hourPnt.x,
            y: hourPnt.y + 4.5,
            align: "middle",
            text: hour || "12"
          }).setFont({ family: "Avenir Next W00", style: "bold", size: "9pt" }).setFill(hourColor);

        }

        if(hoursOfDay.hasOwnProperty(hour)) {
          // COUNT LABEL //
          var hourOfDayCount = hoursOfDay[hour];

          var radius = (isAM) ? (outerRadius - 22) : (outerRadius + 22);
          var countPnt = this._pointTo(nodeCenter, radius, azimuth + 15.0);

          var hourBin = surface.createCircle({
            cx: countPnt.x,
            cy: countPnt.y,
            r: 5.5 + (25.0 * (hourOfDayCount / 50.0))
          }).setFill("#ec5e2d");
          hourBin.selected = false;
          hourBin.hour = hour;

          surface.createText({
            x: countPnt.x,
            y: countPnt.y + 4.5,
            align: "middle",
            text: hourOfDayCount
          }).setFont({ family: "Avenir Next W00", style: "bold", size: "9pt" }).setFill("#fff");

          hourBins.push(hourBin);
        }
      }

      return hourBins;
    },

    createHoursSurface: function (node, label, hoursOfDay, minHour, maxHour) {

      // NODE DIMENSIONS //
      var nodeBox = domGeom.getContentBox(node);
      var nodeCenter = { x: nodeBox.w * 0.5, y: nodeBox.h * 0.5 };
      var outerRadius = (nodeBox.h * 0.3);

      var circleOutlineColor = "#ec5e2d";
      var circleFillColor = "rgba(36, 36, 36, 0.7)";
      var centerColor = "#ccc";
      var hourColor = "#ccc";

      // SURFACE //
      var surface = gfx.createSurface(node, nodeBox.w, nodeBox.h);

      // OUTER CIRCLE //
      surface.createCircle({
        cx: nodeCenter.x,
        cy: nodeCenter.y,
        r: outerRadius
      }).setStroke({ color: circleOutlineColor, style: "solid", width: 1.5 }).setFill(circleFillColor);

      // CENTER LABEL //
      surface.createText({
        x: nodeCenter.x,
        y: nodeCenter.y + 5.5,
        align: "middle",
        text: label
      }).setFont({ family: "Avenir Next W00", size: "11pt" }).setFill(centerColor);


      var hourBins = [];

      // CREATE BIN FOR EACH HOUR //
      for (var hour = minHour; hour <= maxHour; hour++) {
        var hourIndex = (hour > 12) ? (hour - 12) : hour;
        var azimuth = (hourIndex * 30.0);

        // HOUR LABEL //
        var hourPnt = this._pointTo(nodeCenter, outerRadius + 11, azimuth);
        surface.createText({
          x: hourPnt.x,
          y: hourPnt.y + 4.5,
          align: "middle",
          text: hourIndex || "12"
        }).setFont({ family: "Avenir Next W00", style: "bold", size: "9pt" }).setFill(hourColor);

        if(hoursOfDay.hasOwnProperty(hour)) {
          // COUNT LABEL //
          var hourOfDayCount = hoursOfDay[hour];
          var countPnt = this._pointTo(nodeCenter, outerRadius - 22, azimuth + 15.0);

          var hourBin = surface.createCircle({
            cx: countPnt.x,
            cy: countPnt.y,
            r: 5.5 + (25.0 * (hourOfDayCount / 50.0))
          }).setFill("#ec5e2d");
          hourBin.selected = false;
          hourBin.hour = hour;

          surface.createText({
            x: countPnt.x,
            y: countPnt.y + 4.5,
            align: "middle",
            text: hourOfDayCount
          }).setFont({ family: "Avenir Next W00", style: "bold", size: "9pt" }).setFill("#fff");

          hourBins.push(hourBin);
        }
      }

      return hourBins;
    },


    createHourEvents: function (hourBins) {

      function highlightBin(circle, highlight) {
        if(!circle.selected) {
          circle.setStroke(highlight ? { color: "#ccc", style: "solid", width: 1.5 } : null);
        }
      }

      function selectBin(circle, selected) {
        circle.selected = selected;
        circle.setStroke(selected ? { color: "#fff", style: "solid", width: 1.5 } : null);
      }

      array.forEach(hourBins, function (hourBin) {

        hourBin.on("click", function (evt) {

          var startDate = this.getStartOfDayUTC(this.currentFilter.range[0]);
          this.updateFilter({
            range: [
              date.add(startDate, "hour", hourBin.hour),
              date.add(startDate, "hour", hourBin.hour + 1)
            ],
            isDayUpdate: false
          });
          this.filterEarthquakes();

          array.forEach(hourBins, function (otherHourBin) {
            selectBin(otherHourBin, false);
          }.bind(this));
          selectBin(hourBin, true);
        }.bind(this));


        hourBin.on(mouse.enter, function (evt) {
          highlightBin(hourBin, true);
          on.once(evt.target, mouse.leave, function () {
            highlightBin(hourBin, false);
          }.bind(this));
        }.bind(this));

      }.bind(this));

    },


    /**
     *
     * @param parentNode
     * @param magnitudes
     */
    displayMagnitudes: function (parentNode, magnitudes) {

      // NODE DIMENSIONS //
      var nodeBox = domGeom.getContentBox(parentNode);
      var titleBoxHeight = 18;
      var nodeCenter = { x: nodeBox.w * 0.4, y: (nodeBox.h + titleBoxHeight) * 0.5 };

      var magnitudeRings = 7;
      var outerRadius = (nodeBox.h - titleBoxHeight) * 0.35;
      var radiusStep = Math.round((outerRadius) / magnitudeRings);

      // SURFACE //
      var surface = gfx.createSurface(parentNode, nodeBox.w, nodeBox.h);

      // TOP LABELS //
      var labelPnt = this._pointTo(nodeCenter, (outerRadius + radiusStep), 0.0);
      surface.createText({
        x: labelPnt.x,
        y: (titleBoxHeight * 0.5),
        align: "middle",
        text: "Magnitude"
      }).setFont({ family: "Avenir Next W00", style: "bold", size: "8pt" }).setFill("#fff");
      surface.createText({
        x: labelPnt.x + outerRadius + 50.0,
        y: (titleBoxHeight * 0.5),
        align: "middle",
        text: "Count"
      }).setFont({ family: "Avenir Next W00", style: "bold", size: "8pt" }).setFill("#fff");

      var allMagnitudeCircles = [];
      var maxMagnitudeCount = 150.0;
      for (var magnitudeIndex = 0; magnitudeIndex <= magnitudeRings; magnitudeIndex++) {
        var radius = radiusStep + (magnitudeIndex * radiusStep);

        var magnitudeCount = magnitudes.hasOwnProperty(magnitudeIndex) ? magnitudes[magnitudeIndex] : 0;
        var ringWidth = (magnitudeCount > 0) ? 1.0 + (10.5 * (magnitudeCount / maxMagnitudeCount)) : 0.5;
        var ringColor = (magnitudeCount > 0) ? "#ec5e2d" : "#444";
        var connectorColor = (magnitudeCount > 0) ? "#803319" : "#444";

        // MAGNITUDE RING //
        var magnitudeCircle = surface.createCircle({
          cx: nodeCenter.x,
          cy: nodeCenter.y,
          r: radius
        }).setStroke({ color: ringColor, style: "solid", width: ringWidth });


        // MAGNITUDE LABEL //
        var magnitudeLabelPnt = this._pointTo(nodeCenter, radius, 0.0);
        if(magnitudeCount > 0) {
          // CONNECTOR LINE //
          surface.createLine({
            x1: magnitudeLabelPnt.x,
            y1: magnitudeLabelPnt.y,
            x2: magnitudeLabelPnt.x + outerRadius + 40.0,
            y2: magnitudeLabelPnt.y
          }).setStroke({ color: connectorColor, style: "solid", width: 0.5 });
          // MAGNITUDE COUNT //
          surface.createText({
            x: magnitudeLabelPnt.x + outerRadius + 50.0,
            y: magnitudeLabelPnt.y + 4.0,
            align: "middle",
            text: magnitudeCount
          }).setFont({ family: "Avenir Next W00", style: "bold", size: "8pt" }).setFill("#fff");
        }

        // MAGNITUDE INDEX LABEL //
        var indexCircle = surface.createCircle({
          cx: magnitudeLabelPnt.x,
          cy: magnitudeLabelPnt.y,
          r: 6.5
        }).setFill("#ddd");

        surface.createText({
          x: magnitudeLabelPnt.x,
          y: magnitudeLabelPnt.y + 4.0,
          align: "middle",
          text: (magnitudeIndex + 1)
        }).setFont({ family: "Avenir Next W00", size: "8pt" }).setFill(ringColor);


        if(magnitudeCount > 0) {
          magnitudeCircle.selected = false;
          magnitudeCircle.magnitude = (magnitudeIndex + 1.0);
          allMagnitudeCircles.push([indexCircle, magnitudeCircle]);
        }

      }


      function highlightCircle(circles, highlight) {
        if(!circles[0].selected) {
          circles[1].setStroke(lang.mixin(circles[1].getStroke(), { color: highlight ? "#ccc" : "#ec5e2d" }));
        }
      }

      function selectCircle(circles, selected) {
        circles[0].selected = selected;
        circles[1].setStroke(lang.mixin(circles[1].getStroke(), { color: selected ? "#fff" : "#ec5e2d" }));
      }

      array.forEach(allMagnitudeCircles, function (magnitudeCircles) {

        var indexCircle = magnitudeCircles[0];
        var magnitudeCircle = magnitudeCircles[1];

        indexCircle.on("click", function (evt) {

          this.updateFilter({
            maxMag: magnitudeCircle.magnitude,
            isDayUpdate: false
          });
          this.filterEarthquakes();

          array.forEach(allMagnitudeCircles, function (otherMagnitudeCircles) {
            selectCircle(otherMagnitudeCircles, false);
          }.bind(this));
          selectCircle(magnitudeCircles, true);
        }.bind(this));


        indexCircle.on(mouse.enter, function (evt) {
          highlightCircle(magnitudeCircles, true);
          on.once(evt.target, mouse.leave, function () {
            highlightCircle(magnitudeCircles, false);
          }.bind(this));
        }.bind(this));

      }.bind(this));


    },

    _aziToDeg: function (azimuth) {
      return (-azimuth + 90.0);
    },

    _degToRad: function (degrees) {
      return degrees * (Math.PI / 180.0);
    },

    _aziToRadians: function (azimuth) {
      return this._degToRad(this._aziToDeg(azimuth));
    },

    _pointTo: function (p, dist, azimuth) {
      var radians = this._aziToRadians(azimuth);
      return {
        x: p.x + Math.cos(radians) * dist,
        y: p.y - Math.sin(radians) * dist
      };
    }

  });
});
