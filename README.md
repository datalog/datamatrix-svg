![SVG Data Matrix Generator](img/datamatrix.svg)

## Data Matrix svg generator [![LICENSE](img/license.svg)](/LICENSE)
Data Matrix generator written on pure javascript. Produces highly optimized SVG nodes.

[Data Matrix svg generator](https://datalog.github.io/demo/datamatrix-svg/) (Live demo)

## Easy to start
After `datamatrix.min.js` is downloaded and connected to your html5 page, call:
```javascript
var
svgNode = DATAMatrix('Hello World!');
```

All other options:
```javascript
var
svgNode = DATAMatrix({

     msg :  "Your message here"
    ,dim :   256
    ,rct :   0
    ,pad :   2
    ,pal : ["#000000", "#f2f4f8"]
    ,vrb :   0

});
```

## Options
* **msg** - Data Matrix [`message`](#message-types--formats) string. **Mandatory parameter**
* **rct** - set `1` to render rectangle Data Matrix if possible, default value is `0`.
* **dim** - is equal to needed dimention (height) in pixels, default value is `256`.
* **pad** - white space padding, default value is `2` blocks, set `0` for no padding.
* **pal** - is array of [`color`,`background-color`] strings that represent hex color codes, default value is [`'#000'`] along with transparent background. Set [`'#000'`,`'#fff'`] to make background opaque.
* **vrb** - svg node is optimized to be compact and default value is `0`, set this parameter to `1` in case you need more verbose output.

## Message
The function evaluates the input string and tries to find a compact combination of supported encoding modes (**ASCII, TEXT, C40, X12, EDIFACT, and BASE256**) to keep the barcode size reasonable.

It also handles `<FNC1>` and `<GS>` string tags, translating them into the appropriate non-printable control characters during the encoding process:
```javascript
// GS1 / Industrial layout example:
var svgNode = DATAMatrix("<FNC1>1234<GS>1234567890");
```

*Note: Always verify the generated barcode with a hardware scanner or an industry-standard validation app to ensure it encodes exactly what your target system expects.*

## Thanks
Special thanks to [@adrianschlatter](https://github.com) for his detailed feedback and bug reports. 

I recently checked in on this repository and found his technical comments. Fixing those edge cases was a great task, and it actually pushed me to recover this GitHub account just days before it was lost. Thank you, Adrian!
