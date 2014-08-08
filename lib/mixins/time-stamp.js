module.exports = function timestamps(Model, options) {
  
  Model.defineProperty('createdAt', { type: 'date' });
  Model.defineProperty('updatedAt', { type: 'date' });
  
  var originalBeforeSave = Model.beforeSave;
  Model.beforeSave = function(next, data) {
      Model.applyTimestamps(data, this.isNewRecord());
      if (data.createdAt) this.createdAt = data.createdAt;
      if (data.updatedAt) this.updatedAt = data.updatedAt;
      if (originalBeforeSave) {
          originalBeforeSave.apply(this, arguments);
      } else {
          next();
      }
  };
  
  Model.applyTimestamps = function(data, creation) {
      data.updatedAt = new Date();
      if (creation) data.createdAt = data.updatedAt; 
  };
  
};
