// Store the data globally
let citiesData = [];
let currentSortColumn = 'state';
let sortAscending = true;
let currentFilteredData = []; // New variable to track currently filtered data

// Fetch and process the data
async function fetchData() {
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRASvts5jgMbp0HrVI_iJNytSOjpjx_F9vHg78wyYtk6-F9SwKpk-SIN54cjObfF-KSUqbC8zBBt7-C/pub?gid=482452490&single=true&output=csv';

    try {
        const response = await fetch(url);
        const csvText = await response.text();
        const rows = csvText.split('\n').map(row => row.split(','));
        const headers = rows[0];

        citiesData = rows.slice(1).map(row => {
            // Remove any quotes and trim whitespace from population
            const populationStr = row[5].replace(/"/g, '').trim();
            // Remove commas and any other non-numeric characters except decimal points
            const cleanPopulation = populationStr.replace(/[^\d.]/g, '');

            return {
                rank: row[0],
                city: row[1],
                state: row[2],
                latitude: parseFloat(row[3]),
                longitude: parseFloat(row[4]),
                population: parseFloat(cleanPopulation) || 0, // Use 0 as fallback if parsing fails
                income: row[6] ? parseInt(row[6].replace(/[^\d]/g, '')) : 0
            };
        });

        // Add console logging to debug the data
        console.log('First few rows of processed data:', citiesData.slice(0, 3));

        renderTable(citiesData);
        initializeMap();
    } catch (error) {
        console.error('Error fetching or processing data:', error);
    }
}

// Table rendering function
function renderTable(data) {
    const tbody = document.querySelector('#citiesTable tbody');
    tbody.innerHTML = '';

    data.forEach(city => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${city.state}</td>
            <td>${city.city}</td>
            <td>${city.population ? city.population.toLocaleString() : '0'}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update the map with filtered data
function updateMap(filteredData) {
    // Clear existing circles
    d3.select('#map').selectAll('circle').remove();

    // Recalculate radius scale with filtered data
    const populationExtent = d3.extent(filteredData, d => d.population);
    const radiusScale = d3.scaleSqrt()
        .domain(populationExtent)
        .range([4, 20]);

    // Add circles for filtered cities
    d3.select('#map').select('svg')
        .selectAll('circle')
        .data(filteredData)
        .enter()
        .append('circle')
        .attr('class', 'city-circle')
        .attr('cx', d => projection([d.longitude, d.latitude])[0])
        .attr('cy', d => projection([d.longitude, d.latitude])[1])
        .attr('r', d => radiusScale(d.population));
}

// Update the filter function to handle both table and map
function filterData(searchTerm) {
    const filtered = citiesData.filter(city =>
        city.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
        city.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        city.population.toString().includes(searchTerm)
    );

    currentFilteredData = filtered; // Store current filtered data
    renderTable(filtered);
    updateMap(filtered);
}

// Update map initialization to store projection globally
let projection; // Declare projection globally

async function initializeMap() {
    const width = document.querySelector('.map-container').clientWidth;
    const height = document.querySelector('.map-container').clientHeight;

    // Create SVG
    const svg = d3.select('#map')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Create projection and store it globally
    projection = d3.geoAlbersUsa()
        .translate([width / 2, height / 2])
        .scale(width);

    // Load US map data
    const us = await d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');

    // Draw states
    svg.append('g')
        .selectAll('path')
        .data(topojson.feature(us, us.objects.states).features)
        .enter()
        .append('path')
        .attr('d', d3.geoPath().projection(projection))
        .attr('fill', '#ddd')
        .attr('stroke', '#fff');

    // Initial map rendering with all data
    updateMap(citiesData);
}

// Update the sort function to maintain filtered view
function sortData(column) {
    if (currentSortColumn === column) {
        sortAscending = !sortAscending;
    } else {
        currentSortColumn = column;
        sortAscending = true;
    }

    const dataToSort = currentFilteredData.length > 0 ? currentFilteredData : citiesData;

    dataToSort.sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];

        if (column === 'population') {
            return sortAscending ? valueA - valueB : valueB - valueA;
        }

        return sortAscending
            ? valueA.localeCompare(valueB)
            : valueB.localeCompare(valueA);
    });

    renderTable(dataToSort);
    updateMap(dataToSort);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize data
    fetchData();

    // Add sorting listeners
    document.querySelectorAll('th').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            sortData(column);
        });
    });

    // Add search listener
    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterData(e.target.value);
    });
});