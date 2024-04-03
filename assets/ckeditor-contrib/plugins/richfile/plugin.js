// Rich CKEditor integration plugin - Bastiaan Terhorst

(function(){

	function generateUUID() {
		var cryptoObj = window.crypto || window.msCrypto; // for IE 11
		if (!cryptoObj || !cryptoObj.getRandomValues) {
			// If crypto API is not available, fall back to Math.random
			var d = new Date().getTime();
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = (d + Math.random() * 16) % 16 | 0;
				d = Math.floor(d / 16);
				return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
			});
		}
	
		var buffer = new Uint16Array(8);
		cryptoObj.getRandomValues(buffer);
	
		return (
			pad4(buffer[0]) + pad4(buffer[1]) + '-' +
			pad4(buffer[2]) + '-' +
			pad4(buffer[3]) + '-' +
			pad4(buffer[4]) + '-' +
			pad4(buffer[5]) + pad4(buffer[6]) + pad4(buffer[7])
		);
	}
	
	function pad4(num) {
		var ret = num.toString(16);
		while (ret.length < 4) {
			ret = '0' + ret;
		}
		return ret;
	}

	// Convert the Data URL to a Blob
	function dataURLtoBlob(dataUrl) {
		var parts = dataUrl.split(',');
		var contentType = parts[0].split(';')[0].split(':')[1];
		var raw = window.atob(parts[1]);
		var rawLength = raw.length;
		var uint8Array = new Uint8Array(rawLength);

		for (var i = 0; i < rawLength; ++i) {
			uint8Array[i] = raw.charCodeAt(i);
		}

		return new Blob([uint8Array], { type: contentType });
	}

	CKEDITOR.plugins.add('richfile',
	{
	    init: function(editor) {

			// register a callback that actually inserts a selected image
	    editor._.insertImagefn = CKEDITOR.tools.addFunction(function(url, id, name){
				this.insertHtml('<img src="' + url + '" alt="" data-rich-file-id="' + id + '" />');
			}, editor);

			editor._.insertFilefn = CKEDITOR.tools.addFunction(function(url, id, name){
				this.insertHtml('<a href="' + url + '" data-rich-file-id="' + id + '">' + name + '</a>');
			}, editor);
			
			// double click an image to replace it
			editor.on( 'doubleclick', function(evt) {
					var element = evt.data.element;

					if (element.is('img') && !element.data('cke-realelement') && !element.isReadOnly()) {
						editor.execCommand('insertRichImage');
					}
			});

			// clean up the callback
			editor.on( 'destroy', function () { CKEDITOR.tools.removeFunction( this._.insertImagefn ); } );

			// Bind to the paste event
			editor.on('paste', function(evt) {
				// Your callback function logic here
				var params = {};
				params.simplified_type = "image";
				params.scoped = editor.config.scoped || false;
				if (params.scoped == true) {
					params.scope_type = editor.config.scope_type
					params.scope_id = editor.config.scope_id;
				}
				params.authenticity_token = $("input[name='authenticity_token']").attr("value")
				
				const tag = '<html><head></head><body><img src="data:image';
				const val = evt.data.dataValue;
				if (val && evt.data.type === "html" && val.substring(0, tag.length) === tag) {
					console.log("img detected");
					evt.cancel();
					var parser = new DOMParser();
					const imgType = val.substring(tag.length + 1, val.indexOf(";base64"));
					var doc = parser.parseFromString(evt.data.dataValue, 'text/html');
					var url = addQueryString(editor.config.richBrowserUrl, params );
					// Find a specific tag within the document
					var targetDiv = doc.getElementsByTagName('img');
					if (targetDiv.length === 1) {
						const imgSrc = targetDiv[0].getAttribute("src");
						const imgData = dataURLtoBlob(imgSrc);
						const imgName = "paste-" + generateUUID() + "." + imgType;
						params.qqFile = imgName;

						var xhr = new XMLHttpRequest();			
						var queryString = $.param(params);
						const path = editor.config.richBrowserUrl;
						var file = new File([imgData], imgName, {type: imgData.type})
						xhr.open("POST", path.substring(0, path.length - 1) + "?" + queryString, true);
						xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
						xhr.setRequestHeader("X-File-Name", encodeURIComponent(imgName));
						xhr.setRequestHeader("Content-Type", "application/octet-stream");
						xhr.send(file);
						
						xhr.onreadystatechange = function () {
							if (xhr.readyState === 4) {
								if (xhr.status === 200) {
									// Parse response text as JSON
									var jsonResponse = JSON.parse(xhr.responseText);
									// Call the callback function with the JSON response
									const id = jsonResponse.rich_id;
									const imgUrl = jsonResponse.url;
									console.log("img id " + id);
									targetDiv[0].setAttribute("src", jsonResponse.prefix + imgUrl);
									var serializer = new XMLSerializer();
									var str = serializer.serializeToString(doc);

									var currentContent = editor.getData();
									const content2Update = currentContent + str;
									editor.setData(content2Update);
								} else {
									console.error('Error uploading file: ' + xhr.statusText);
									alert("插入图片失败");
								}
							} else {
								alert("插入图片失败");
								console.error('Error uploading file: ' + xhr.statusText);
							}
						};
					}					
				}
			});

			editor.addCommand( 'insertRichImage', {
				exec: function(editor) {
					var params = {};
					params.CKEditor = editor.name;
					params.CKEditorFuncNum = editor._.insertImagefn;
					params.default_style = editor.config.default_style;
					params.allowed_styles = editor.config.allowed_styles;
					params.insert_many = editor.config.insert_many;
					params.type = "image";
					params.scoped = editor.config.scoped || false;
					if(params.scoped == true) {
						params.scope_type = editor.config.scope_type
						params.scope_id = editor.config.scope_id;
					}
					params.viewMode = editor.config.view_mode || "grid";
					var url = addQueryString(editor.config.richBrowserUrl, params );
					editor.popup(url, 860, 500);
				}
			});

			editor.addCommand( 'insertRichFile', {
				exec: function(editor) {
					var params = {};
					params.CKEditor = editor.name;
					params.CKEditorFuncNum = editor._.insertFilefn;
					params.default_style = "original";
					params.allowed_styles = "original";
					params.insert_many = editor.config.insert_many;
					params.type = "file";
					params.scoped = editor.config.scoped || false;
					if(params.scoped == true) {
						params.scope_type = editor.config.scope_type
						params.scope_id = editor.config.scope_id;
					}
					params.viewMode = editor.config.view_mode || "list";
					var url = addQueryString(editor.config.richBrowserUrl, params );
					editor.popup(url, 860, 500);
				}
			});

			editor.ui.addButton( 'richImage', {
				label : "Browse and upload images",
				command: 'insertRichImage',
				icon: '../images/images.png'
			});

			editor.ui.addButton( 'richFile', {
				label : "Browse and upload files",
				command: 'insertRichFile',
				icon: '../images/files.png'
			});

	    }
	});

})();
