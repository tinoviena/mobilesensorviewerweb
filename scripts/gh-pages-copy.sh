rm -rf docs
mkdir -p docs 
cp index.html docs/ 
sed -i 's|dist/app.js|js/app.js|g' docs/index.html
cp -r dist docs/
mv docs/dist docs/js
cp buildnr.txt docs/
touch ./docs/.nojekyll
