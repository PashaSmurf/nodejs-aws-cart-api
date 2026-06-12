import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as rds from '@aws-cdk/aws-rds';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as path from 'path';

export class CartApiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'CartApiVpc', {
      maxAzs: 2,
    });

    // Security Groups
    const lambdaSecurityGroup = new ec2.SecurityGroup(
      this,
      'LambdaSecurityGroup',
      {
        vpc,
        description: 'Security group for Lambda',
        allowAllOutbound: true,
      },
    );

    const rdsSecurityGroup = new ec2.SecurityGroup(
      this,
      'RDSSecurityGroup',
      {
        vpc,
        description: 'Security group for RDS',
        allowAllOutbound: false,
      },
    );

    // Allow Lambda to connect to RDS
    rdsSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to RDS',
    );

    // Bastion Security Group (for database access via Systems Manager Session Manager)
    const bastionSecurityGroup = new ec2.SecurityGroup(
      this,
      'BastionSecurityGroup',
      {
        vpc,
        description: 'Security group for Bastion EC2 instance',
        allowAllOutbound: true,
      },
    );

    // Allow Bastion to connect to RDS
    rdsSecurityGroup.addIngressRule(
      bastionSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Bastion to RDS',
    );

    // IAM Role for Bastion to use Systems Manager Session Manager
    const bastionRole = new iam.Role(this, 'BastionRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });
    bastionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
    );

    // Create Bastion EC2 Instance (Amazon Linux 2)
    const bastion = new ec2.Instance(this, 'BastionInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      securityGroup: bastionSecurityGroup,
      role: bastionRole,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // Install PostgreSQL client on Bastion
    bastion.addUserData(
      'yum update -y',
      'yum install -y postgresql',
    );

    // RDS Database Instance with fixed password
    const dbPassword = 'CartApi2024Pass123!';
    const database = new rds.DatabaseInstance(this, 'CartDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      allocatedStorage: 20,
      storageType: rds.StorageType.GP2,
      vpc,
      securityGroups: [rdsSecurityGroup],
      databaseName: 'cart_db',
      credentials: rds.Credentials.fromPassword('postgres', cdk.SecretValue.plainText(dbPassword)),
      multiAz: false,
      publiclyAccessible: false,
      deletionProtection: false,
    });

    const dbHost = database.dbInstanceEndpointAddress;
    const dbPort = database.dbInstanceEndpointPort;


    // Lambda Function
    const cartApiFunction = new lambda.Function(this, 'CartApiFunction', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'dist/src/lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../'), {
        exclude: [
          'node_modules/.bin',
          'node_modules/@aws-cdk',
          'node_modules/aws-cdk',
          'cdk',
          'cdk.out',
          '.git',
          '.idea',
          'test',
          'coverage',
          '.gitignore',
          '.env',
          'IMPLEMENTATION_SUMMARY.txt',
          'CURL_COMMANDS.txt',
          '*.md',
          'dist/cdk',
        ],
      }),
      vpc,
      securityGroups: [lambdaSecurityGroup],
      environment: {
        DB_HOST: dbHost,
        DB_PORT: dbPort,
        DB_USERNAME: 'postgres',
        DB_PASSWORD: dbPassword,
        DB_NAME: 'cart_db',
        DB_SSL: 'false',
        NODE_ENV: 'production',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'CartApi', {
      restApiName: 'Cart API',
      description: 'Cart Service API',
      deploy: true,
    });

    // Add Lambda proxy integration
    const lambdaIntegration = new apigateway.LambdaIntegration(
      cartApiFunction,
      {
        requestTemplates: {
          'application/json': 'method.request.header.Authorization',
        },
      },
    );

    // Route all requests to Lambda
    api.root.addMethod('ANY', lambdaIntegration);
    api.root.addResource('{proxy+}').addMethod('ANY', lambdaIntegration);

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'Cart API Endpoint',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: dbHost,
      description: 'RDS Database Endpoint',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: cartApiFunction.functionArn,
      description: 'Lambda Function ARN',
    });


    new cdk.CfnOutput(this, 'BastionPublicIp', {
      value: bastion.instancePublicIp || 'N/A',
      description: 'Bastion EC2 Instance ID (access via Systems Manager Session Manager)',
    });

    new cdk.CfnOutput(this, 'BastionInstanceId', {
      value: bastion.instanceId,
      description: 'Bastion Instance ID for Session Manager',
    });

    new cdk.CfnOutput(this, 'RDSPrivateEndpoint', {
      value: dbHost,
      description: 'RDS Private Endpoint (access via Bastion through Systems Manager Session Manager)',
    });
  }
}
