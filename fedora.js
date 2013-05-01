$(document).ready(function () { 
		// when page1Link link is clicked, page1 shows, 
        // page2 hides
        $(home_planet).bind("click", function () {
				alert('test');
				$(index).hide();
        });

        // when page2Link link is clicked, page2 shows, 
        // page1 hides
        $(page2Link).bind("click", function () {
            $(page1).hide();
            $(page2).show();
        });
});
