# igv-data
igv-data is a branch in a fork of the main igv.js repo.  
It excludes large portions of the igv.js browser code, leaving only the code for reading and parsing various genomic file formats.
This allows the data-reading portions of igv.js to be reused in another application without the overhead of the entire browser.

# To build (rollup):
```npm run build```

# To run unit tests:
```npm run http-server```
Then open a browser and go to http://localhost:8080/test/runTests.html 

(make sure to clear browser cache between runs, or run with developer tools and network tab set to not cache)


