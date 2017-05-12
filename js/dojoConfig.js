/* global dojoConfig:true */
var package_path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));
dojoConfig = {
  async: true,
  parseOnLoad:true,
  packages: [
    { name: "application", location: package_path + "/js/application", main: "app" },
    { name: "boilerplate", location: package_path + "/js/boilerplate", main: "Boilerplate" },
    { name: "config", location: package_path + "/config" },
    { name: "put-selector", location: "//maps.esri.com/jg/support/put-selector" },
    { name: "widgets", location: "//maps.esri.com/jg/support/widgets" }
  ]
};
if(location.search.match(/locale=([\w-]+)/)) {
  dojoConfig.locale = RegExp.$1;
}
