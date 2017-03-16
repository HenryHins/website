angular.module(SERIFYAPP).config(['$routeProvider', function($routeProvider) {
	$routeProvider.when('/', { templateUrl: 'login/login.html', controller: 'loginController' });
	$routeProvider.when('/main', {redirectTo:'/'});
	$routeProvider.when('/home', {redirectTo:'/'});
}]);
angular.module(SERIFYAPP).controller('loginController', [
	'$scope',
	'$routeParams',
	'$uibModal',
	'loginStatusProvider',
	'eventHandler',
	'pageService',
	'userManager',
	'ngDialog',
	'utilities',
	'linkManager',
	'logoutService',
function($scope, $routeParams, $uibModal, loginStatusProvider, eventHandler, pageService, userManager, ngDialog, utilities, linkManager, logoutService) {
	$scope.closeAlert = function(){ $scope.alert = null; };
	/******** SignInButton Block ********/
	$scope.links = [];
	$scope.$watch('authentication.complete', SetupUser, true);
	function SetupUser() {
		var usernamemetadataPromise = userManager.GetUserDataPromise()
		.then(function(user){
			$scope.$apply(function(){
				$scope.userProfile = (user.userData || {}).profile;
				$scope.username = (user.userData || {}).username;
				var verifications = (user || {}).Verifications || [];
				verifications.map(function(verification) {
					verification.Inverse = verification.Name !== 'HPV' && verification.Name !== 'PrEP';
					verification.Name = TESTS.find(function(t){ return t.id === verification.Name; }).name;
				});
				$scope.verifications = verifications;
			});
		});
		var usernameLinkCreationPromise = linkManager.GetNewLinkPromise(null, null)
		.then(function(link){
			$scope.$apply(function(){
				$scope.userLink = {
					url: WEBSITE_VIEW_URL + link,
					link: link
				};
			});
		});
		return Promise.all([usernamemetadataPromise, usernameLinkCreationPromise]).catch(function(f){ console.log(f); });
	}

	/******** SignInButton Block ********/
	$scope.verifications = [];
	$scope.AddVerificationsButtonClick = function(){
		pageService.NavigateToPage('update');
	};
	$scope.SaveProfileButtonClick = function() {
		userManager.UpdateUserDataPromise({
			profile: $scope.userProfile,
			username: $scope.username
		}).then(function(){
			$scope.$apply(function(){
				$scope.alert = { type: 'success', msg: 'Profile updated' };
			});
		}).catch(function(failure) {
			console.error("Failed to save user profile: " + failure);
			$scope.$apply(function(){
				$scope.alert = { type: 'danger', msg: 'Failed to save profile. Please try again.' };
			});
		});
	};
}]);
